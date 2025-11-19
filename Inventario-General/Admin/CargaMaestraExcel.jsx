import { useState } from 'react';
import * as XLSX from 'xlsx';
import { inventarioGeneralService } from '../../../services/inventarioGeneralService';
import './CargaMaestraExcel.css';

const CargaMaestraExcel = () => {
  const [selectedCompany, setSelectedCompany] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [preview, setPreview] = useState([]);

  const companies = [
    { id: '1', nombre: 'Makro Colombia' },
    { id: '2', nombre: 'Makro Perú' },
    { id: '3', nombre: 'Makro Chile' },
  ];

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      previewExcel(selectedFile);
    }
  };

  const previewExcel = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        // Mostrar solo las primeras 10 filas como preview
        setPreview(jsonData.slice(0, 10));
      } catch (error) {
        setMessage({ type: 'error', text: 'Error al leer el archivo Excel' });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage({ type: 'error', text: 'Por favor selecciona un archivo' });
      return;
    }

    if (!selectedCompany) {
      setMessage({ type: 'error', text: 'Por favor selecciona una compañía' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);

          // Validar que el Excel tenga las columnas necesarias
          if (jsonData.length === 0) {
            setMessage({ type: 'error', text: 'El archivo está vacío' });
            setLoading(false);
            return;
          }

          const requiredColumns = ['item', 'descripcion', 'codigo_barra'];
          const columns = Object.keys(jsonData[0]);
          const hasRequiredColumns = requiredColumns.every(col => 
            columns.some(c => c.toLowerCase().includes(col.toLowerCase()))
          );

          if (!hasRequiredColumns) {
            setMessage({ 
              type: 'error', 
              text: 'El archivo debe contener las columnas: item, descripcion, codigo_barra' 
            });
            setLoading(false);
            return;
          }

          // Formatear datos para inserción
          const formattedData = jsonData.map(row => ({
            item: row.item || row.Item || row.ITEM,
            descripcion: row.descripcion || row.Descripcion || row.DESCRIPCION,
            codigo_barra: row.codigo_barra || row.Codigo_Barra || row.CODIGO_BARRA || row['Código de Barra'],
            compania_id: selectedCompany
          }));

          // Enviar datos al servicio
          const result = await inventarioGeneralService.cargarMaestraItems(formattedData);

          setMessage({ 
            type: 'success', 
            text: `Se cargaron exitosamente ${result.count} items a la base de datos` 
          });
          
          // Limpiar formulario
          setFile(null);
          setPreview([]);
          document.getElementById('file-input').value = '';
        } catch (error) {
          console.error('Error al procesar el archivo:', error);
          setMessage({ 
            type: 'error', 
            text: 'Error al procesar y cargar los datos: ' + error.message 
          });
        } finally {
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: 'Error al cargar el archivo: ' + error.message });
      setLoading(false);
    }
  };

  return (
    <div className="carga-maestra-excel">
      <h2>Carga Maestra de Items desde Excel</h2>
      <p className="subtitle">
        Sube un archivo Excel con las columnas: <strong>item</strong>, <strong>descripcion</strong>, <strong>codigo_barra</strong>
      </p>

      <div className="form-section">
        <div className="form-group">
          <label htmlFor="company-select">Seleccionar Compañía:</label>
          <select
            id="company-select"
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="select-input"
          >
            <option value="">-- Selecciona una compañía --</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="file-input">Seleccionar Archivo Excel:</label>
          <input
            id="file-input"
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            className="file-input"
          />
          {file && <span className="file-name">📄 {file.name}</span>}
        </div>

        <button
          onClick={handleUpload}
          disabled={loading || !file || !selectedCompany}
          className="upload-button"
        >
          {loading ? 'Cargando...' : 'Cargar Datos a la Base de Datos'}
        </button>

        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}
      </div>

      {preview.length > 0 && (
        <div className="preview-section">
          <h3>Vista Previa (Primeras 10 filas)</h3>
          <div className="table-container">
            <table className="preview-table">
              <thead>
                <tr>
                  {preview[0].map((header, idx) => (
                    <th key={idx}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(1).map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CargaMaestraExcel;
