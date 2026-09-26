"use client";

import Image from "next/image";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
import {
  CATALOG_CATEGORIES,
  countCatalogCategories,
  filterCatalog,
  filterCatalogDiscovery,
  filterCatalogFacets,
  groupCatalogByCollaboration,
  sortCatalog,
  type CatalogAvailability,
  type CatalogCategory,
  type CatalogDiscoveryMode,
  type CatalogPriceRange,
  type CatalogSort
} from "../application/catalog-query";
import type { CatalogItem } from "../domain/catalog-item";
import { CatalogCard } from "./catalog-card";

const PAGE_SIZE = 48;

const SORT_LABELS: Readonly<Record<CatalogSort, string>> = {
  newest: "Más nuevo",
  featured: "Destacados",
  "price-asc": "Menor precio",
  "price-desc": "Mayor precio"
};

const MODE_LABELS: Readonly<Record<CatalogDiscoveryMode, string>> = {
  new: "Novedades",
  popular: "Popular ahora",
  all: "Todo el catálogo"
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

type CatalogView = "items" | "collections";

export function CatalogGrid({ items }: { items: readonly CatalogItem[] }) {
  const searchId = useId();
  const sortId = useId();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CatalogCategory>("Todos");
  const [mode, setMode] = useState<CatalogDiscoveryMode>("new");
  const [sort, setSort] = useState<CatalogSort>("newest");
  const [collaboration, setCollaboration] = useState<string | null>(null);
  const [availability, setAvailability] = useState<CatalogAvailability>("all");
  const [priceRange, setPriceRange] = useState<CatalogPriceRange>("all");
  const [rarity, setRarity] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [catalogView, setCatalogView] = useState<CatalogView>("items");
  const [collectionQuery, setCollectionQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const deferredQuery = useDeferredValue(query);
  const discoveryItems = useMemo(() => filterCatalogDiscovery(items, mode), [items, mode]);
  const counts = useMemo(() => countCatalogCategories(discoveryItems), [discoveryItems]);
  const categories = CATALOG_CATEGORIES.filter(
    (candidate) => candidate === "Todos" || counts[candidate] > 0
  );
  const matchingItems = useMemo(
    () => filterCatalog(discoveryItems, deferredQuery, category),
    [discoveryItems, deferredQuery, category]
  );
  const filteredItems = useMemo(
    () => filterCatalogFacets(matchingItems, { collaboration, availability, priceRange, rarity }),
    [matchingItems, collaboration, availability, priceRange, rarity]
  );
  const orderedItems = useMemo(
    () => groupCatalogByCollaboration(sortCatalog(filteredItems, sort)).flatMap((group) => group.items),
    [filteredItems, sort]
  );
  const visibleItems = orderedItems.slice(0, visibleCount);
  const visibleGroups = useMemo(
    () => groupCatalogByCollaboration(visibleItems),
    [visibleItems]
  );
  const hasMore = visibleCount < filteredItems.length;
  const discoveryCounts = useMemo(() => ({
    new: filterCatalogDiscovery(items, "new").length,
    popular: filterCatalogDiscovery(items, "popular").length,
    all: items.length
  }), [items]);
  const collections = useMemo(() => groupCatalogByCollaboration(items)
    .filter((group) => group.name !== "Otros objetos")
    .sort((left, right) => left.name.localeCompare(right.name, "es-MX", { sensitivity: "base" })), [items]);
  const visibleCollections = useMemo(() => {
    const normalizedQuery = collectionQuery.trim().toLocaleLowerCase("es-MX");
    if (!normalizedQuery) return collections;
    return collections.filter((group) => group.name.toLocaleLowerCase("es-MX").includes(normalizedQuery));
  }, [collectionQuery, collections]);
  const rarities = useMemo(() => [...new Set(items.map((item) => item.rarity).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "es-MX", { sensitivity: "base" })), [items]);
  const activeFilterCount = Number(category !== "Todos")
    + Number(Boolean(collaboration))
    + Number(availability !== "all")
    + Number(priceRange !== "all")
    + Number(Boolean(rarity));

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        startTransition(() => {
          setVisibleCount((current) => Math.min(current + PAGE_SIZE, filteredItems.length));
        });
      },
      { rootMargin: "500px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [filteredItems.length, hasMore]);

  useEffect(() => {
    if (!filtersOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [filtersOpen]);

  function selectCategory(nextCategory: CatalogCategory) {
    startTransition(() => {
      setCategory(nextCategory);
      setVisibleCount(PAGE_SIZE);
    });
  }

  function selectMode(nextMode: CatalogDiscoveryMode) {
    startTransition(() => {
      setCatalogView("items");
      setMode(nextMode);
      setSort(nextMode === "popular" ? "featured" : "newest");
      setQuery("");
      setCategory("Todos");
      setCollaboration(null);
      setAvailability("all");
      setPriceRange("all");
      setRarity(null);
      setVisibleCount(PAGE_SIZE);
    });
  }

  function selectCollaboration(nextCollaboration: string | null) {
    startTransition(() => {
      if (nextCollaboration) setCatalogView("items");
      setCollaboration(nextCollaboration);
      if (nextCollaboration) setMode("all");
      setCategory("Todos");
      setQuery("");
      setVisibleCount(PAGE_SIZE);
    });
  }

  function selectSort(nextSort: CatalogSort) {
    startTransition(() => {
      setSort(nextSort);
      setVisibleCount(PAGE_SIZE);
    });
  }

  function clearSearch() {
    startTransition(() => {
      setQuery("");
      setCollaboration(null);
      setVisibleCount(PAGE_SIZE);
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
      setVisibleCount(PAGE_SIZE);
    });
  }

  if (!items.length) return <p className="catalog-empty">No hay ofertas disponibles.</p>;

  return (
    <div className="catalog-explorer">
      <div className="catalog-toolbar">
        <div className="catalog-search">
          <label htmlFor={searchId}>Buscar en la tienda</label>
          <div className="search-field">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m21 21-4.35-4.35m2.35-5.4a7.75 7.75 0 1 1-15.5 0 7.75 7.75 0 0 1 15.5 0Z" />
            </svg>
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
                setVisibleCount(PAGE_SIZE);
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
                ×
              </button>
            )}
          </div>
        </div>

        {catalogView === "items" && <><div className="catalog-sort">
          <label htmlFor={sortId}>Ordenar</label>
          <select
            id={sortId}
            value={sort}
            onChange={(event) => selectSort(event.target.value as CatalogSort)}
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="catalog-filter-toggle"
          aria-expanded={filtersOpen}
          aria-controls="catalog-filters"
          onClick={() => setFiltersOpen((current) => !current)}
        >
          Filtros {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
        </button>

        <div className="catalog-result-count" aria-live="polite">
          <strong>{filteredItems.length}</strong>
          <span>{filteredItems.length === 1 ? "resultado" : "resultados"}</span>
        </div>
        </>}
      </div>

      <div className="catalog-modes" role="group" aria-label="Descubrir objetos">
        <button
          type="button"
          className={mode === "new" ? "active" : undefined}
          aria-pressed={mode === "new"}
          onClick={() => selectMode("new")}
        >
          <span aria-hidden="true">✦</span>
          <span><strong>Novedades</strong><small>{discoveryCounts.new} objetos recién llegados</small></span>
        </button>
        <button
          type="button"
          className={mode === "popular" ? "active" : undefined}
          aria-pressed={mode === "popular"}
          onClick={() => selectMode("popular")}
        >
          <span aria-hidden="true">↗</span>
          <span><strong>Popular ahora</strong><small>{discoveryCounts.popular} objetos destacados</small></span>
        </button>
        <button
          type="button"
          className={mode === "all" ? "active" : undefined}
          aria-pressed={mode === "all"}
          onClick={() => selectMode("all")}
        >
          <span aria-hidden="true">⌘</span>
          <span><strong>Todo el catálogo</strong><small>{discoveryCounts.all} objetos disponibles</small></span>
        </button>
      </div>

      <div className="catalog-view-tabs" role="tablist" aria-label="Vista del catálogo">
        <button
          type="button"
          role="tab"
          aria-selected={catalogView === "items"}
          className={catalogView === "items" ? "active" : undefined}
          onClick={() => setCatalogView("items")}
        >
          Objetos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={catalogView === "collections"}
          className={catalogView === "collections" ? "active" : undefined}
          onClick={() => {
            startTransition(() => {
              setCatalogView("collections");
              setMode("all");
              setCollaboration(null);
              setCategory("Todos");
              setQuery("");
              setCollectionQuery("");
            });
          }}
        >
          Colecciones <span>{collections.length}</span>
        </button>
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
                className="catalog-filter-close"
                aria-label="Cerrar filtros"
                onClick={() => setFiltersOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="catalog-filter-fields">
                <fieldset className="catalog-filter-group catalog-filter-category">
                  <legend>Categoría</legend>
                  <div className="catalog-filter-options compact">
                    {categories.map((candidate) => (
                      <button
                        type="button"
                        key={candidate}
                        className={category === candidate ? "active" : undefined}
                        aria-pressed={category === candidate}
                        onClick={() => selectCategory(candidate)}
                      >
                        {candidate} <small>{counts[candidate]}</small>
                      </button>
                    ))}
                  </div>
                </fieldset>
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
                          setVisibleCount(PAGE_SIZE);
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
                          setVisibleCount(PAGE_SIZE);
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
                          setVisibleCount(PAGE_SIZE);
                        }}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </fieldset>
            </div>
            <div className="catalog-filter-actions">
              {activeFilterCount > 0 && (
                <button type="button" className="catalog-filter-clear" onClick={clearAllFilters}>
                  Limpiar filtros
                </button>
              )}
              <button type="button" className="catalog-filter-apply" onClick={() => setFiltersOpen(false)}>
                Ver {filteredItems.length} resultados
              </button>
            </div>
          </section>
        </>
      )}

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

      {catalogView === "items" && activeFilterCount > 0 && (
        <div className="active-filters" aria-label="Filtros aplicados">
          <span>Filtros:</span>
          {category !== "Todos" && (
            <button type="button" onClick={() => selectCategory("Todos")}>{category} ×</button>
          )}
          {collaboration && (
            <button type="button" onClick={() => selectCollaboration(null)}>{collaboration} ×</button>
          )}
          {priceRange !== "all" && (
            <button type="button" onClick={() => setPriceRange("all")}>Precio ×</button>
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

      <div className="catalog-list-heading">
        {catalogView === "collections" ? (
          <div><p>Explora por universo</p><h3>{visibleCollections.length} colecciones</h3></div>
        ) : (
          <div><p>{MODE_LABELS[mode]}</p><h3>{filteredItems.length} {filteredItems.length === 1 ? "objeto" : "objetos"}</h3></div>
        )}
        <span>{catalogView === "collections" ? "Elige una colección para ver sus objetos" : collaboration ? `Colección ${collaboration}` : "Explora y elige tu favorito"}</span>
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
                    aria-label={`Abrir ${group.name}, ${group.items.length} ${group.items.length === 1 ? "objeto" : "objetos"}`}
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
                      <span><small>Colección</small><strong>{group.name}</strong></span>
                      <b>{group.items.length} {group.items.length === 1 ? "objeto" : "objetos"} <span aria-hidden="true">→</span></b>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="collection-empty">No encontramos esa colección.</p>
            )}
          </div>
        ) : visibleItems.length ? (
            <div className="catalog-collaborations">
              {visibleGroups.map((group, groupIndex) => {
                const startingIndex = visibleGroups
                  .slice(0, groupIndex)
                  .reduce((count, previousGroup) => count + previousGroup.items.length, 0);

                return (
                  <section className="catalog-collaboration" key={group.name}>
                    <div className="catalog-collaboration-heading">
                      <p>COLABORACIÓN / COLECCIÓN</p>
                      <h2>{group.name}</h2>
                      <span>{group.items.length} {group.items.length === 1 ? "objeto" : "objetos"}</span>
                    </div>
                    <div className="catalog-grid">
                      {group.items.map((item, itemIndex) => (
                        <CatalogCard
                          key={item.mainId}
                          item={item}
                          index={startingIndex + itemIndex}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
        ) : (
          <div className="catalog-empty">
            <span aria-hidden="true">⌕</span>
            <h3>No encontramos ese objeto</h3>
            <p>Prueba otro nombre o cambia la categoría.</p>
            <button type="button" onClick={clearAllFilters}>Ver todo el catálogo</button>
          </div>
        )}
      </div>

      {catalogView === "items" && hasMore && (
        <div className="catalog-load-more" ref={loadMoreRef}>
          <button
            type="button"
            onClick={() => startTransition(() => setVisibleCount((current) => current + PAGE_SIZE))}
          >
            Mostrar más objetos
          </button>
          <span>Mostrando {visibleItems.length} de {filteredItems.length}</span>
        </div>
      )}
    </div>
  );
}
