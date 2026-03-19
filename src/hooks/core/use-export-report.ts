import { useCallback } from 'react';
import { toast } from 'sonner';

interface ExportRow {
  [key: string]: string | number | boolean | null | undefined;
}

export function useExportReport() {
  const exportCSV = useCallback((data: ExportRow[], filename: string) => {
    if (!data.length) {
      toast.error('Sem dados para exportar.');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvLines = [
      headers.join(';'),
      ...data.map(row =>
        headers.map(h => {
          const val = row[h];
          if (val == null) return '';
          const str = String(val);
          return str.includes(';') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        }).join(';')
      ),
    ];

    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Relatório "${filename}" exportado!`);
  }, []);

  return { exportCSV };
}
