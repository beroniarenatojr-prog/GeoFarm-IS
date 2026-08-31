import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useState } from 'react'
import { ChevronDown, ChevronUp, Search, Download } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * Which page numbers to draw.
 *
 * Every page gets a button while there are few of them. Past that, the first
 * and last are always reachable and a window follows the current page, with
 * `null` marking a gap — a farmer with five years of seasons would otherwise
 * push a row of thirty buttons across the page.
 */
function pageWindow(current, total, span = 1) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);

  const wanted = new Set([0, total - 1, current]);
  for (let i = current - span; i <= current + span; i++) {
    if (i > 0 && i < total - 1) wanted.add(i);
  }

  const out = [];
  let previous = null;
  for (const page of [...wanted].sort((a, b) => a - b)) {
    if (previous !== null && page - previous > 1) out.push(null);
    out.push(page);
    previous = page;
  }
  return out;
}

export default function DataTable({
  columns,
  data,
  enableExport = true,
  filename = 'data',
  stickyScroll = false,
  maxHeight = 'calc(100vh - 22rem)',
}) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      globalFilter,
      sorting,
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
  })

  // Counted after filtering but before paging: the old footer reported the
  // rows on screen, so a farmer with 51 seasons read "10 rows" on every page.
  const matched = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();
  const { pageIndex, pageSize } = table.getState().pagination;
  const firstRow = matched === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRow = Math.min(matched, (pageIndex + 1) * pageSize);

  const handleExport = () => {
    const csv = data.map(row => columns.map(col => row[col.accessorKey] || '').join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    toast.success('Exported!')
  }

  return (
    <div className="w-full">
      {/* Search & Export */}
      <div className="flex items-center justify-between mb-4">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search all columns..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          />
        </div>
        {enableExport && (
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all text-sm font-medium">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        )}
      </div>
      
      {/* Table */}
      <div
        className={
          stickyScroll
            ? 'rounded-xl border bg-card shadow-sm overflow-auto sticky-scrollbar'
            : 'rounded-xl border bg-card overflow-hidden shadow-sm'
        }
        style={stickyScroll ? { maxHeight } : undefined}
      >
        <table className={stickyScroll ? 'min-w-max w-full' : 'w-full'}>
          <thead className={stickyScroll ? 'sticky top-0 z-10 bg-gray-50 dark:bg-gray-800' : 'bg-muted/50'}>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th 
                    key={header.id}
                    className="h-12 px-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: <ChevronUp className="h-3 w-3" />,
                        desc: <ChevronDown className="h-3 w-3" />,
                      }[header.column.getIsSorted()] ?? null}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-accent hover:cursor-pointer transition-colors">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-3 text-sm align-top whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <span className="text-sm text-muted-foreground">
          {matched === 0 ? (
            'No rows'
          ) : (
            <>
              Showing <span className="font-semibold text-gray-700">{firstRow}–{lastRow}</span>
              {' '}of <span className="font-semibold text-gray-700">{matched}</span>
              {matched === 1 ? ' row' : ' rows'}
              {/* Say so when a search is hiding some, otherwise the total
                  looks as though records have gone missing. */}
              {matched !== data.length && (
                <span className="text-gray-400"> (filtered from {data.length})</span>
              )}
            </>
          )}
        </span>

        {pageCount > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
            >
              Previous
            </button>

            {pageWindow(pageIndex, pageCount).map((page, i) =>
              page === null ? (
                <span key={`gap-${i}`} className="px-1.5 text-sm text-gray-400 select-none">…</span>
              ) : (
                <button
                  key={page}
                  onClick={() => table.setPageIndex(page)}
                  aria-current={page === pageIndex ? 'page' : undefined}
                  aria-label={`Page ${page + 1}`}
                  className={`min-w-[2rem] px-2 py-1 rounded-lg border text-sm transition-colors ${
                    page === pageIndex
                      ? 'border-green-600 bg-green-600 font-semibold text-white'
                      : 'border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {page + 1}
                </button>
              ),
            )}

            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

