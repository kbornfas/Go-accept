import { Download, FileText, File } from 'lucide-react';
import { saveAs } from 'file-saver';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function ExportButtons({ data, filename = 'escrows', type = 'escrow' }) {
  const exportCSV = () => {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text(`${filename.toUpperCase()} Report`, 14, 22);
    
    // Add date
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

    if (type === 'escrow') {
      // Prepare escrow data for table
      const tableData = data.map(item => [
        item.id || '',
        item.platform || '',
        `${item.amount || 0} ${item.currency || ''}`,
        item.status || '',
        new Date(item.createdAt).toLocaleDateString()
      ]);

      doc.autoTable({
        startY: 40,
        head: [['ID', 'Platform', 'Amount', 'Status', 'Created']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [139, 92, 246] }
      });
    } else if (type === 'audit') {
      // Prepare audit log data for table
      const tableData = data.map(item => [
        item.action || '',
        item.details?.userEmail || '',
        item.resource_type || '',
        item.ip_address || '',
        new Date(item.created_at).toLocaleString()
      ]);

      doc.autoTable({
        startY: 40,
        head: [['Action', 'User', 'Resource', 'IP Address', 'Timestamp']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [139, 92, 246] }
      });
    }

    doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={exportCSV}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
      >
        <FileText className="w-4 h-4" />
        Export CSV
      </button>
      <button
        onClick={exportPDF}
        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
      >
        <File className="w-4 h-4" />
        Export PDF
      </button>
    </div>
  );
}
