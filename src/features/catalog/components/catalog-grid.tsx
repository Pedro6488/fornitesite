"use client";

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
  getLatestShopDate,
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
  featured: "Popular ahora",
  "price-asc": "Menor precio",
  "price-desc": "Mayor precio"
};

const MODE_LABELS: Readonly<Record<CatalogDiscoveryMode, string>> = {
  new: "Novedades",
  popular: "Popular ahora",
  all: "Todo el catálogo"
};

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
  const latestShopDate = useMemo(() => getLatestShopDate(items), [items]);
  const latestCollaborations = useMemo(() => {
    if (!latestShopDate) return [];
    return groupCatalogByCollaboration(sortCatalog(
      items.filter((item) => item.shopInDate === latestShopDate && item.collaboration?.trim()),
      "featured"
    ));
  }, [items, latestShopDate]);
  const collections = useMemo(() => groupCatalogByCollaboration(items)
    .filter((group) => group.name !== "Otros objetos")
    .sort((left, right) => left.name.localeCompare(right.name, "es-MX", { sensitivity: "base" })), [items]);
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

  function selectCategory(nextCategory: CatalogCategory) {
    startTransition(() => {
      setCategory(nextCategory);
      setVisibleCount(PAGE_SIZE);
    });
  }

  function selectMode(nextMode: CatalogDiscoveryMode) {
    startTransition(() => {
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
      setCollaboration(nextCollaboration);
      if (nextCollaboration) setMode("all");
      setCategory("Todos");
      setQuery("");
      setVisibleCount(PAGE_SIZE);
    });
  }

  function selectLatestCollaboration(nextCollaboration: string) {
    startTransition(() => {
      setMode("new");
      setSort("newest");
      setCollaboration(nextCollaboration);
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
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setMode("all");
                setCollaboration(null);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="Busca personaje, objeto o colección..."
              autoComplete="off"
            />
            {query && <button type="button" onClick={clearSearch} aria-label="Limpiar búsqueda">×</button>}
          </div>
        </div>

        <div className="catalog-sort">
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

      {latestCollaborations.length > 0 && (
        <div className="latest-discovery" aria-label="Colaboraciones recién llegadas">
          <div className="latest-discovery-label">
            <span aria-hidden="true" /> Recién llegados
          </div>
          <div className="latest-collaborations">
            <button
              type="button"
              onClick={() => selectMode("new")}
            >
              Ver novedades
            </button>
            {latestCollaborations.map((group) => (
              <button
                type="button"
                key={group.name}
                className={collaboration === group.name ? "active" : undefined}
                aria-pressed={collaboration === group.name}
                onClick={() => selectLatestCollaboration(group.name)}
              >
                {group.name} <small>{group.items.length}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        className={`catalog-filter-panel ${filtersOpen ? "open" : ""}`}
        id="catalog-filters"
      >
        <div className="catalog-filter-heading">
          <div><strong>Afina tu búsqueda</strong><span>Combina los filtros que necesites</span></div>
          {activeFilterCount > 0 && <button type="button" onClick={clearAllFilters}>Limpiar todo</button>}
        </div>
        <div className="catalog-filter-fields">
          <label>
            Colección
            <select
              value={collaboration ?? ""}
              onChange={(event) => selectCollaboration(event.target.value || null)}
            >
              <option value="">Todas las colecciones</option>
              {collections.map((group) => (
                <option value={group.name} key={group.name}>{group.name} ({group.items.length})</option>
              ))}
            </select>
          </label>
          <label>
            Precio MXN
            <select
              value={priceRange}
              onChange={(event) => {
                setPriceRange(event.target.value as CatalogPriceRange);
                setVisibleCount(PAGE_SIZE);
              }}
            >
              <option value="all">Cualquier precio</option>
              <option value="under-80">Hasta $80</option>
              <option value="80-120">De $81 a $120</option>
              <option value="120-160">De $121 a $160</option>
              <option value="over-160">Más de $160</option>
            </select>
          </label>
          <label>
            Disponibilidad
            <select
              value={availability}
              onChange={(event) => {
                setAvailability(event.target.value as CatalogAvailability);
                setVisibleCount(PAGE_SIZE);
              }}
            >
              <option value="all">Todos</option>
              <option value="available">Listos para comprar</option>
              <option value="preview">Solo vista previa</option>
            </select>
          </label>
          <label>
            Rareza
            <select
              value={rarity ?? ""}
              onChange={(event) => {
                setRarity(event.target.value || null);
                setVisibleCount(PAGE_SIZE);
              }}
            >
              <option value="">Todas las rarezas</option>
              {rarities.map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </label>
        </div>
        <button type="button" className="catalog-filter-apply" onClick={() => setFiltersOpen(false)}>
          Ver {filteredItems.length} resultados
        </button>
      </div>

      <div className="category-list" role="group" aria-label="Filtrar por categoría">
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
      </div>

      {(mode !== "all" || activeFilterCount > 0) && (
        <div className="active-filters" aria-label="Filtros aplicados">
          <span>Viendo:</span>
          {mode !== "all" && (
            <button type="button" onClick={() => selectMode("all")}>{MODE_LABELS[mode]} ×</button>
          )}
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
        <div><p>{MODE_LABELS[mode]}</p><h3>{filteredItems.length} {filteredItems.length === 1 ? "objeto" : "objetos"}</h3></div>
        <span>{collaboration ? `Colección ${collaboration}` : "Explora y elige tu favorito"}</span>
      </div>

      <div className="catalog-results">
        {visibleItems.length ? (
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

      {hasMore && (
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
