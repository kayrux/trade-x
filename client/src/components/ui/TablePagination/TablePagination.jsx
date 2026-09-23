import { ChevronLeft, ChevronRight } from 'lucide-react';
import './TablePagination.css';

export default function TablePagination({ page, pageCount, total, pageSize, onPageChange }) {
  if (pageCount <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="table-pagination">
      <span className="table-pagination__info">{start}–{end} of {total}</span>
      <div className="table-pagination__controls">
        <button
          className="table-pagination__btn"
          aria-label="Previous page"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={15} />
        </button>
        <span className="table-pagination__page">Page {page} of {pageCount}</span>
        <button
          className="table-pagination__btn"
          aria-label="Next page"
          disabled={page === pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
