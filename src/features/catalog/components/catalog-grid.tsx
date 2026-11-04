"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpDown, ChevronDown, Flame, Grid2X2, Layers, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  CATALOG_CATEGORIES,
  UNGROUPED_COLLABORATION,
  countCatalogCategories,
  filterCatalog,
  filterCatalogDiscovery,
  filterCatalogFacets,
  groupCatalogByCollaboration,
  orderCatalogGroups,
  sortCatalog,
  type CatalogAvailability,
  type CatalogCategory,
  type CatalogDiscoveryMode,
  type CatalogPriceRange,
  type CatalogSort
} from "../application/catalog-query";
import {
  CATALOG_PAGE_SIZE,
  defaultCatalogSort,
  parseCatalogUrlState,
  serializeCatalogUrlState,
  type CatalogView
} from "../application/catalog-url-state";
import type { CatalogItem } from "../domain/catalog-item";
import { CatalogCard } from "./catalog-card";
import { SystemActionBar } from "@/shared/components/system-action-bar";

/** Dos filas de 5 columnas; con menos columnas el CSS oculta el sobrante para no dejar filas incompletas. */
const GROUP_PREVIEW_SIZE = 10;
/** A partir de aquí algún tamaño de pantalla deja objetos fuera de la vista previa. */
const GROUP_PREVIEW_MIN_VISIBLE = 6;
const URL_WRITE_DELAY_MS = 250;

const SORT_LABELS: Readonly<Record<CatalogSort, string>> = {
  newest: "Más nuevo",
  featured: "Destacados",
  "price-asc": "Menor precio",
  "price-desc": "Mayor precio"
};

const PRICE_OPTIONS: readonly { value: CatalogPriceRange; label: string }[] = [
  { value: "all", label: "Cualquier precio" },
  { value: "under-80", label: "Hasta $80" },
  { value: "80-120", label: "$81 a $120" },
  { value: "120-160", label: "$121 a $160" },
  { value: "over-160", label: "Más de $160" }
];

const AVAILABILITY_OPTIONS: readonly { value: CatalogAvailability; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "available", label: "Listos para comprar" },
  { value: "preview", label: "Solo vista previa" }
];

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

export function CatalogGrid({ items }: { items: readonly CatalogItem[] }) {
  const searchId = useId();
  const sortId = useId();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const filterToggleRef = useRef<HTMLButtonElement>(null);
  const filterCloseRef = useRef<HTMLButtonElement>(null);
  const lastFilterSignature = useRef<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CatalogCategory>("Todos");
  const [mode, setMode] = useState<CatalogDiscoveryMode>("all");
  const [sort, setSort] = useState<CatalogSort>("newest");
  const [collaboration, setCollaboration] = useState<string | null>(null);
  const [availability, setAvailability] = useState<CatalogAvailability>("all");
  const [priceRange, setPriceRange] = useState<CatalogPriceRange>("all");
  const [rarity, setRarity] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [catalogView, setCatalogView] = useState<CatalogView>("items");
  const [collectionQuery, setCollectionQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(CATALOG_PAGE_SIZE);
  const [urlReady, setUrlReady] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const hasSearch = deferredQuery.trim().length > 0;
  const discoveryItems = useMemo(() => filterCatalogDiscovery(items, mode), [items, mode]);
  const facetedItems = useMemo(
    () => filterCatalogFacets(
      filterCatalog(discoveryItems, deferredQuery, "Todos"),
      { collaboration, availability, priceRange, rarity }
    ),
    [discoveryItems, deferredQuery, collaboration, availability, priceRange, rarity]
  );
  // Los conteos de cada categoría responden a la búsqueda y a los filtros ya aplicados.
  const counts = useMemo(() => countCatalogCategories(facetedItems), [facetedItems]);
  const categories = CATALOG_CATEGORIES.filter(
    (candidate) => candidate === "Todos" || candidate === category || counts[candidate] > 0
  );
  const filteredItems = useMemo(() => filterCatalog(facetedItems, "", category), [facetedItems, category]);
  // Al ordenar por precio, buscar o filtrar importa el objeto, no la colección a la que pertenece.
  const priceSorted = sort === "price-asc" || sort === "price-desc";
  const groupedView = !priceSorted && !hasSearch && category === "Todos" && availability === "all" && priceRange === "all" && !rarity;
  const previewGroups = groupedView && !collaboration;
  const listGroups = useMemo(() => {
    const sorted = sortCatalog(filteredItems, sort);
    return groupedView ? orderCatalogGroups(groupCatalogByCollaboration(sorted)) : [{ name: "", items: sorted }];
  }, [filteredItems, sort, groupedView]);
  const isPreviewed = (groupName: string) => previewGroups && groupName !== UNGROUPED_COLLABORATION;
  const listableCount = listGroups.reduce(
    (total, group) => total + (isPreviewed(group.name) ? Math.min(group.items.length, GROUP_PREVIEW_SIZE) : group.items.length),
    0
  );
  const visibleGroups: { name: string; total: number; startingIndex: number; items: readonly CatalogItem[] }[] = [];
  let remainingSlots = visibleCount;
  let shownCount = 0;
  for (const group of listGroups) {
    if (remainingSlots <= 0) break;
    const limit = isPreviewed(group.name) ? GROUP_PREVIEW_SIZE : group.items.length;
    const shown = group.items.slice(0, Math.min(limit, remainingSlots));
    visibleGroups.push({ name: group.name, total: group.items.length, startingIndex: shownCount, items: shown });
    remainingSlots -= shown.length;
    shownCount += shown.length;
  }
  const hasMore = visibleCount < listableCount;
  const discoveryCounts = useMemo(() => ({
    new: filterCatalogDiscovery(items, "new").length,
    popular: filterCatalogDiscovery(items, "popular").length,
    all: items.length
  }), [items]);
  const collections = useMemo(() => orderCatalogGroups(groupCatalogByCollaboration(items)
    .filter((group) => group.name !== UNGROUPED_COLLABORATION)
    .sort((left, right) => left.name.localeCompare(right.name, "es-MX", { sensitivity: "base" }))), [items]);
  const visibleCollections = useMemo(() => {
    const normalizedQuery = collectionQuery.trim().toLocaleLowerCase("es-MX");
    if (!normalizedQuery) return collections;
    return collections.filter((group) => group.name.toLocaleLowerCase("es-MX").includes(normalizedQuery));
  }, [collectionQuery, collections]);
  const rarities = useMemo(() => [...new Set(items.map((item) => item.rarity).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "es-MX", { sensitivity: "base" })), [items]);
  const secondaryFilterCount = Number(availability !== "all")
    + Number(priceRange !== "all")
    + Number(Boolean(rarity));
  const activeFilterCount = secondaryFilterCount
    + Number(category !== "Todos")
    + Number(Boolean(collaboration));
  const filterSignature = JSON.stringify([catalogView, mode, sort, deferredQuery, category, collaboration, availability, priceRange, rarity]);

  // Antes de pintar, para que al volver de un objeto la lista ya tenga su altura y el scroll se restaure bien.
  // Va en un efecto porque el HTML del servidor no conoce la URL: leerla al inicializar rompería la hidratación.
  useLayoutEffect(() => {
    const restored = parseCatalogUrlState(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización única desde la URL al montar.
    setCatalogView(restored.view);
    setMode(restored.mode);
    setSort(restored.sort);
    setCategory(restored.category);
    setCollaboration(restored.collaboration);
    setAvailability(restored.availability);
    setPriceRange(restored.priceRange);
    setRarity(restored.rarity);
    setVisibleCount(restored.visibleCount);
    if (restored.view === "collections") setCollectionQuery(restored.query);
    else setQuery(restored.query);
    setUrlReady(true);
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const timer = window.setTimeout(() => {
      const search = serializeCatalogUrlState({
        view: catalogView,
        mode,
        sort,
        category,
        collaboration,
        availability,
        priceRange,
        rarity,
        query: catalogView === "collections" ? collectionQuery : query,
        visibleCount
      });
      const { pathname, hash, search: currentSearch } = window.location;
      if (search !== currentSearch) window.history.replaceState(null, "", `${pathname}${search}${hash}`);
    }, URL_WRITE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [urlReady, catalogView, mode, sort, category, collaboration, availability, priceRange, rarity, query, collectionQuery, visibleCount]);

  // Si cambian los resultados con la persona ya abajo en la lista, la regresa al inicio de los resultados.
  useEffect(() => {
    if (!urlReady) return;
    const changed = lastFilterSignature.current !== null && lastFilterSignature.current !== filterSignature;
    lastFilterSignature.current = filterSignature;
    if (!changed) return;
    const results = resultsRef.current;
    if (results && results.getBoundingClientRect().top < 0) results.scrollIntoView?.({ block: "start", behavior: "instant" });
  }, [urlReady, filterSignature]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        startTransition(() => {
          setVisibleCount((current) => Math.min(current + CATALOG_PAGE_SIZE, listableCount));
        });
      },
      { rootMargin: "500px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [listableCount, hasMore]);

  useEffect(() => {
    if (!filtersOpen) return;

    const previousOverflow = document.body.style.overflow;
    const toggle = filterToggleRef.current;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    filterCloseRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      toggle?.focus();
    };
  }, [filtersOpen]);

  function selectCategory(nextCategory: CatalogCategory) {
    startTransition(() => {
      setCategory(nextCategory);
      setVisibleCount(CATALOG_PAGE_SIZE);
    });
  }

  function selectMode(nextMode: CatalogDiscoveryMode) {
    startTransition(() => {
      setCatalogView("items");
      setMode(nextMode);
      setSort(defaultCatalogSort(nextMode));
      setQuery("");
      setCategory("Todos");
      setCollaboration(null);
      setAvailability("all");
      setPriceRange("all");
      setRarity(null);
      setVisibleCount(CATALOG_PAGE_SIZE);
    });
  }

  function openCollections() {
    startTransition(() => {
      setCatalogView("collections");
      setMode("all");
      setCollaboration(null);
      setCategory("Todos");
      setQuery("");
      setCollectionQuery("");
    });
  }

  function selectCollaboration(nextCollaboration: string | null) {
    startTransition(() => {
      if (nextCollaboration) setCatalogView("items");
      setCollaboration(nextCollaboration);
      if (nextCollaboration) setMode("all");
      setCategory("Todos");
      setQuery("");
      setVisibleCount(CATALOG_PAGE_SIZE);
    });
  }

  function selectSort(nextSort: CatalogSort) {
    startTransition(() => {
      setSort(nextSort);
      setVisibleCount(CATALOG_PAGE_SIZE);
    });
  }

  function clearSearch() {
    startTransition(() => {
      setQuery("");
      setCollaboration(null);
      setVisibleCount(CATALOG_PAGE_SIZE);
    });
  }

  function clearAllFilters() {
    startTransition(() => {
      setCatalogView("items");
      setMode("all");
      setSort("newest");
      setQuery("");
      setCategory("Todos");
      setCollaboration(null);
      setAvailability("all");
      setPriceRange("all");
      setRarity(null);
      setVisibleCount(CATALOG_PAGE_SIZE);
    });
  }

  if (!items.length) return <p className="catalog-empty">No hay ofertas disponibles.</p>;

  const scopes = [
    { id: "all", label: "Todo", count: discoveryCounts.all, icon: Grid2X2, active: catalogView === "items" && mode === "all", onSelect: () => selectMode("all") },
    { id: "new", label: "Novedades", count: discoveryCounts.new, icon: Sparkles, active: catalogView === "items" && mode === "new", onSelect: () => selectMode("new") },
    { id: "popular", label: "Populares", count: discoveryCounts.popular, icon: Flame, active: catalogView === "items" && mode === "popular", onSelect: () => selectMode("popular") },
    { id: "collections", label: "Colecciones", count: collections.length, icon: Layers, active: catalogView === "collections", onSelect: openCollections }
  ];
  const searchText = query.trim();

  return (
    <div className="catalog-explorer">
      <div className="catalog-scope-row">
        <div className="catalog-scopes" role="group" aria-label="Qué quieres ver">
          {scopes.map(({ id, label, count, icon: Icon, active, onSelect }) => (
            <button
              type="button"
              key={id}
              className={active ? "active" : undefined}
              aria-pressed={active}
              onClick={onSelect}
            >
              <Icon aria-hidden="true" size={15} />
              {label}
              <small>{count}</small>
            </button>
          ))}
        </div>
        <nav className="catalog-community-nav" aria-label="Comunidad">
          <Link href="/clientes">Clientes</Link>
          <Link href="/referencias">Referencias</Link>
        </nav>
      </div>

      <div className="catalog-command-bar">
        <div className="catalog-toolbar">
          <div className="catalog-search">
            <label htmlFor={searchId}>Buscar en la tienda</label>
            <div className="search-field">
              <Search aria-hidden="true" size={18} strokeWidth={2} />
              <input
                id={searchId}
                type="search"
                value={catalogView === "collections" ? collectionQuery : query}
                onChange={(event) => {
                  if (catalogView === "collections") {
                    setCollectionQuery(event.target.value);
                    return;
                  }
                  setQuery(event.target.value);
                  setMode("all");
                  setCollaboration(null);
                  setVisibleCount(CATALOG_PAGE_SIZE);
                }}
                placeholder={catalogView === "collections" ? "Busca una colección..." : "Busca personaje, objeto o colección..."}
                autoComplete="off"
              />
              {(catalogView === "collections" ? collectionQuery : query) && (
                <button
                  type="button"
                  onClick={catalogView === "collections" ? () => setCollectionQuery("") : clearSearch}
                  aria-label="Limpiar búsqueda"
                >
                  <X aria-hidden="true" size={17} />
                </button>
              )}
            </div>
          </div>

          {catalogView === "items" && <>
            <div className="catalog-sort">
              <label htmlFor={sortId}>Ordenar</label>
              <span className="select-control">
                <select id={sortId} value={sort} onChange={(event) => selectSort(event.target.value as CatalogSort)}>
                  {Object.entries(SORT_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
                <ChevronDown aria-hidden="true" size={17} />
                <ArrowUpDown aria-hidden="true" size={18} />
              </span>
            </div>

            <button
              type="button"
              ref={filterToggleRef}
              className="catalog-filter-toggle"
              aria-expanded={filtersOpen}
              aria-controls="catalog-filters"
              onClick={() => setFiltersOpen((current) => !current)}
            >
              <SlidersHorizontal aria-hidden="true" size={16} />
              <span className="catalog-filter-label">Filtros</span>
              {secondaryFilterCount > 0 && <b>{secondaryFilterCount}</b>}
            </button>
          </>}
        </div>

        {catalogView === "items" && <div className="category-list" role="group" aria-label="Filtrar por categoría">
          {categories.map((candidate) => (
            <button
              type="button"
              key={candidate}
              className={candidate === category ? "active" : undefined}
              aria-pressed={candidate === category}
              onClick={() => selectCategory(candidate)}
            >
              <span>{candidate}</span>
              <small>{counts[candidate]}</small>
            </button>
          ))}
        </div>}
      </div>

      {filtersOpen && (
        <>
          <button
            type="button"
            className="catalog-filter-backdrop"
            aria-label="Cerrar filtros"
            onClick={() => setFiltersOpen(false)}
          />
          <section
            className="catalog-filter-panel"
            id="catalog-filters"
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalog-filter-title"
          >
            <div className="catalog-filter-heading">
              <div>
                <strong id="catalog-filter-title">Filtrar catálogo</strong>
                <span>Elige solo lo que te interesa</span>
              </div>
              <button
                type="button"
                ref={filterCloseRef}
                className="catalog-filter-close"
                aria-label="Cerrar filtros"
                onClick={() => setFiltersOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="catalog-filter-fields">
                <fieldset className="catalog-filter-group">
                  <legend>Precio MXN</legend>
                  <div className="catalog-filter-options">
                    {PRICE_OPTIONS.map((option) => (
                      <button
                        type="button"
                        key={option.value}
                        className={priceRange === option.value ? "active" : undefined}
                        aria-pressed={priceRange === option.value}
                        onClick={() => {
                          setPriceRange(option.value);
                          setVisibleCount(CATALOG_PAGE_SIZE);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="catalog-filter-group">
                  <legend>Disponibilidad</legend>
                  <div className="catalog-filter-options">
                    {AVAILABILITY_OPTIONS.map((option) => (
                      <button
                        type="button"
                        key={option.value}
                        className={availability === option.value ? "active" : undefined}
                        aria-pressed={availability === option.value}
                        onClick={() => {
                          setAvailability(option.value);
                          setVisibleCount(CATALOG_PAGE_SIZE);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="catalog-filter-group">
                  <legend>Rareza</legend>
                  <div className="catalog-filter-options compact">
                    <button
                      type="button"
                      className={rarity === null ? "active" : undefined}
                      aria-pressed={rarity === null}
                      onClick={() => setRarity(null)}
                    >
                      Todas
                    </button>
                    {rarities.map((value) => (
                      <button
                        type="button"
                        key={value}
                        className={rarity === value ? "active" : undefined}
                        aria-pressed={rarity === value}
                        onClick={() => {
                          setRarity(value);
                          setVisibleCount(CATALOG_PAGE_SIZE);
                        }}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </fieldset>
            </div>
            <SystemActionBar className="catalog-filter-actions" variant="contained">
              {activeFilterCount > 0 && (
                <button type="button" className="catalog-filter-clear" onClick={clearAllFilters}>
                  Limpiar filtros
                </button>
              )}
              <button type="button" className="catalog-filter-apply" onClick={() => setFiltersOpen(false)}>
                Ver {filteredItems.length} {plural(filteredItems.length, "resultado", "resultados")}
              </button>
            </SystemActionBar>
          </section>
        </>
      )}

      <div className="catalog-result-bar" ref={resultsRef}>
        <p className="catalog-result-count" aria-live="polite">
          {catalogView === "collections" ? (
            <><strong>{visibleCollections.length}</strong> <span>{plural(visibleCollections.length, "colección", "colecciones")}</span></>
          ) : (
            <><strong>{filteredItems.length}</strong> <span>{plural(filteredItems.length, "resultado", "resultados")}</span></>
          )}
        </p>
        {catalogView === "items" && activeFilterCount > 0 && (
          <div className="active-filters" role="group" aria-label="Filtros aplicados">
            {category !== "Todos" && (
              <button type="button" onClick={() => selectCategory("Todos")}>{category} ×</button>
            )}
            {collaboration && (
              <button type="button" onClick={() => selectCollaboration(null)}>{collaboration} ×</button>
            )}
            {priceRange !== "all" && (
              <button type="button" onClick={() => setPriceRange("all")}>{PRICE_OPTIONS.find((option) => option.value === priceRange)?.label} ×</button>
            )}
            {availability !== "all" && (
              <button type="button" onClick={() => setAvailability("all")}>{availability === "available" ? "Listos para comprar" : "Vista previa"} ×</button>
            )}
            {rarity && (
              <button type="button" onClick={() => setRarity(null)}>{rarity} ×</button>
            )}
            <button type="button" className="clear" onClick={clearAllFilters}>Limpiar todo</button>
          </div>
        )}
      </div>

      <div className="catalog-results">
        {catalogView === "collections" ? (
          <div className="catalog-collection-explorer">
            {visibleCollections.length ? (
              <div className="catalog-collection-showcase">
                {visibleCollections.map((group) => (
                  <button
                    type="button"
                    className="catalog-collection-card"
                    key={group.name}
                    aria-label={`Abrir ${group.name}, ${group.items.length} ${plural(group.items.length, "objeto", "objetos")}`}
                    onClick={() => selectCollaboration(group.name)}
                  >
                    <span className="catalog-collection-art" aria-hidden="true">
                      {group.items.filter((item) => item.imageUrl).slice(0, 3).map((item, index) => (
                        <span className={`collection-preview collection-preview-${index + 1}`} key={item.mainId}>
                          <Image src={item.imageUrl!} alt="" fill loading="lazy" sizes="(max-width: 600px) 45vw, 20vw" />
                        </span>
                      ))}
                    </span>
                    <span className="catalog-collection-copy">
                      <strong>{group.name}</strong>
                      <b>{group.items.length} {plural(group.items.length, "objeto", "objetos")} <span aria-hidden="true">→</span></b>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="collection-empty">No encontramos esa colección.</p>
            )}
          </div>
        ) : shownCount > 0 ? (
            <div className="catalog-collaborations">
              {visibleGroups.map((group) => {
                const previewed = isPreviewed(group.name);
                return (
                  <section className="catalog-collaboration" key={group.name || "resultados"} aria-label={group.name || "Resultados"}>
                    {group.name && (
                      <div className="catalog-collaboration-heading">
                        <h2>{group.name}</h2>
                        <span>{group.total} {plural(group.total, "objeto", "objetos")}</span>
                        {previewed && group.total > GROUP_PREVIEW_MIN_VISIBLE && (
                          <button type="button" onClick={() => selectCollaboration(group.name)} aria-label={`Ver los ${group.total} objetos de ${group.name}`}>
                            Ver todos <ArrowRight aria-hidden="true" size={15} />
                          </button>
                        )}
                      </div>
                    )}
                    <div className={previewed ? "catalog-grid catalog-grid-preview" : "catalog-grid"}>
                      {group.items.map((item, itemIndex) => (
                        <CatalogCard
                          key={item.mainId}
                          item={item}
                          index={group.startingIndex + itemIndex}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
        ) : (
          <div className="catalog-empty">
            <span aria-hidden="true"><Search size={26} /></span>
            <h3>{searchText ? `No encontramos “${searchText}”` : "Ningún objeto coincide con estos filtros"}</h3>
            <p>{searchText ? "Revisa cómo está escrito o prueba con el nombre del personaje o la colección." : "Quita algún filtro para ver más opciones."}</p>
            <button type="button" onClick={clearAllFilters}>Ver todo el catálogo</button>
          </div>
        )}
      </div>

      {catalogView === "items" && hasMore && (
        <div className="catalog-load-more" ref={loadMoreRef}>
          <button
            type="button"
            onClick={() => startTransition(() => setVisibleCount((current) => current + CATALOG_PAGE_SIZE))}
          >
            {previewGroups ? "Mostrar más colecciones" : "Mostrar más objetos"}
          </button>
          <span>
            {previewGroups
              ? `Mostrando ${visibleGroups.length} de ${listGroups.length} colecciones`
              : `Mostrando ${shownCount} de ${filteredItems.length}`}
          </span>
        </div>
      )}
    </div>
  );
}
