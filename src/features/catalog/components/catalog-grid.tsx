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
  type CatalogCategory
} from "../application/catalog-query";
import type { CatalogItem } from "../domain/catalog-item";
import { CatalogCard } from "./catalog-card";

const PAGE_SIZE = 24;

export function CatalogGrid({ items }: { items: readonly CatalogItem[] }) {
  const searchId = useId();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CatalogCategory>("Todos");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const deferredQuery = useDeferredValue(query);
  const counts = useMemo(() => countCatalogCategories(items), [items]);
  const categories = CATALOG_CATEGORIES.filter(
    (candidate) => candidate === "Todos" || counts[candidate] > 0
  );
  const filteredItems = useMemo(
    () => filterCatalog(items, deferredQuery, category),
    [items, deferredQuery, category]
  );
  const visibleItems = filteredItems.slice(0, visibleCount);
  const hasMore = visibleCount < filteredItems.length;

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

  function clearSearch() {
    startTransition(() => {
      setQuery("");
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
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="Busca una skin, lote, rareza..."
              autoComplete="off"
            />
            {query && <button type="button" onClick={clearSearch} aria-label="Limpiar búsqueda">×</button>}
          </div>
        </div>

        <div className="catalog-result-count" aria-live="polite">
          <strong>{filteredItems.length}</strong>
          <span>{filteredItems.length === 1 ? "resultado" : "resultados"}</span>
        </div>
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

      <div className="catalog-results">
        {visibleItems.length ? (
          <div className="catalog-grid">
            {visibleItems.map((item, index) => (
              <CatalogCard key={item.mainId} item={item} index={index} />
            ))}
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
