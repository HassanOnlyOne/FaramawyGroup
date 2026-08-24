import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
}

export interface TableProps<T> extends React.HTMLAttributes<HTMLDivElement> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
}

export function Table<T extends Record<string, any>>({ 
  columns, 
  data, 
  loading, 
  emptyMessage = 'لا توجد بيانات', 
  className, 
  ...props 
}: TableProps<T>) {
  return (
    <div className={cn("w-full overflow-x-auto rounded-xl border border-navy-800 bg-navy-900/40 backdrop-blur-md shadow-xl", className)} {...props} dir="rtl">
      <table className="w-full text-sm text-right text-navy-100">
        <thead className="text-xs uppercase bg-navy-800/50 border-b border-navy-700">
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col" className="px-6 py-4 font-semibold">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-800/50">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="hover:bg-navy-800/20 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="px-6 py-4">
                    <Skeleton variant="text" className="w-full max-w-[150px]" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-12 text-center text-navy-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr key={i} className="hover:bg-navy-800/30 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="px-6 py-4 whitespace-nowrap">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
