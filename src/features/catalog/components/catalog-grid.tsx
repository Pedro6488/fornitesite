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
  getLatestShopDate,
  groupCatalogByCollaboration,
  sortCatalog,
  type CatalogCategory,
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

export function CatalogGrid({ items }: { items: readonly CatalogItem[] }) {
  const searchId = useId();
  const sortId = useId();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CatalogCategory>("Todos");
  const [sort, setSort] = useState<CatalogSort>("newest");
  const [collaboration, setCollaboration] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const deferredQuery = useDeferredValue(query);
  const counts = useMemo(() => countCatalogCategories(items), [items]);
  const categories = CATALOG_CATEGORIES.filter(
    (candidate) => candidate === "Todos" || counts[candidate] > 0
  );
  const matchingItems = useMemo(
    () => filterCatalog(items, deferredQuery, category),
    [items, deferredQuery, category]
  );
  const filteredItems = useMemo(
    () => collaboration
      ? matchingItems.filter((item) => item.collaboration?.trim() === collaboration)
      : matchingItems,
    [matchingItems, collaboration]
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
  const latestShopDate = useMemo(() => getLatestShopDate(items), [items]);
  const latestCollaborations = useMemo(() => {
    if (!latestShopDate) return [];
    return groupCatalogByCollaboration(sortCatalog(
      items.filter((item) => item.shopInDate === latestShopDate && item.collaboration?.trim()),
      "featured"
    ));
  }, [items, latestShopDate]);

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

  function selectCollaboration(nextCollaboration: string | null) {
    startTransition(() => {
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
                setCollaboration(null);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="Busca una skin, lote o colaboración..."
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

        <div className="catalog-result-count" aria-live="polite">
          <strong>{filteredItems.length}</strong>
          <span>{filteredItems.length === 1 ? "resultado" : "resultados"}</span>
        </div>
      </div>

      <div className="catalog-modes" role="group" aria-label="Descubrir objetos">
        <button
          type="button"
          className={sort === "newest" ? "active" : undefined}
          aria-pressed={sort === "newest"}
          onClick={() => selectSort("newest")}
        >
          <span aria-hidden="true">✦</span>
          <span><strong>Más nuevo</strong><small>Lo último que llegó a la tienda</small></span>
        </button>
        <button
          type="button"
          className={sort === "featured" ? "active" : undefined}
          aria-pressed={sort === "featured"}
          onClick={() => selectSort("featured")}
        >
          <span aria-hidden="true">↗</span>
          <span><strong>Popular ahora</strong><small>Lo que Fortnite destaca primero</small></span>
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
              className={collaboration === null ? "active" : undefined}
              aria-pressed={collaboration === null}
              onClick={() => selectCollaboration(null)}
            >
              Ver todo
            </button>
            {latestCollaborations.map((group) => (
              <button
                type="button"
                key={group.name}
                className={collaboration === group.name ? "active" : undefined}
                aria-pressed={collaboration === group.name}
                onClick={() => selectCollaboration(group.name)}
              >
                {group.name} <small>{group.items.length}</small>
              </button>
            ))}
          </div>
        </div>
      )}

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
            <button type="button" onClick={clearSearch}>Limpiar búsqueda</button>
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
