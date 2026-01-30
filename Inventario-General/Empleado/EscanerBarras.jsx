import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import './EscanerBarras.css'; // Importamos CSS exclusivo para forzar estilos y Z-Index

const EscanerBarras = ({ isScanning, setIsScanning, onScan }) => {
    const [zoom, setZoom] = useState(1);
    const [zoomCaps, setZoomCaps] = useState({ min: 1, max: 3, step: 0.1 }); // Valores por defecto seguros
    const [hasZoomMethods, setHasZoomMethods] = useState(false);
    
    useEffect(() => {
        let html5QrCode;

        if (isScanning) {
            const timer = setTimeout(() => {
                // USAR UN ID UNICO para evitar conflictos con otros readers o versiones cachés
                html5QrCode = new Html5Qrcode("reader-modal-unique", { 
                    formatsToSupport: [ 
                        Html5QrcodeSupportedFormats.EAN_13,
                        Html5QrcodeSupportedFormats.EAN_8,
                        Html5QrcodeSupportedFormats.CODE_128,
                        Html5QrcodeSupportedFormats.CODE_39, 
                        Html5QrcodeSupportedFormats.UPC_A,
                        Html5QrcodeSupportedFormats.UPC_E, 
                    ],
                    verbose: false
                });

                const startScanning = (cameraIdOrConfig) => {
                    const config = {
                        fps: 15, 
                        qrbox: { width: 280, height: 200 },
                        aspectRatio: 1.0
                    };

                    html5QrCode.start(
                        cameraIdOrConfig,
                        config,
                        (decodedText) => {
                             if (html5QrCode) {
                                html5QrCode.stop().catch(console.warn);
                            }
                            setIsScanning(false);
                            onScan(decodedText);
                        },
                        () => {} // Ignorar errores de frame
                    )
                    .then(() => {
                        const videoConstraints = {
                            focusMode: "continuous",
                            advanced: [{ focusMode: "continuous" }],
                            height: { min: 480, ideal: 720 } 
                        };

                        html5QrCode.applyVideoConstraints(videoConstraints)
                            .then(() => {
                                // Intentar detectar capacidades REALES de zoom
                                setTimeout(() => {
                                    try {
                                        const video = document.querySelector('#reader-modal-unique video');
                                        if (video && video.srcObject) {
                                            const track = video.srcObject.getVideoTracks()[0];
                                            const capabilities = track.getCapabilities();
                                            
                                            // Verificar si soporta zoom
                                            if (capabilities.zoom) {
                                                setZoomCaps(capabilities.zoom);
                                                setHasZoomMethods(true);
                                                // Intentar setear zoom inicial a un poquito mas que el minimo para enfoque
                                                const initialZoom = Math.min(capabilities.zoom.max, Math.max(capabilities.zoom.min, 1.5));
                                                track.applyConstraints({ advanced: [{ zoom: initialZoom }] });
                                                setZoom(initialZoom);
                                            } else {
                                                // Si no reporta capabilities pero es iOS, a veces funciona igual
                                                // Dejamos los controles activos por si acaso con valores default
                                                setHasZoomMethods(true);
                                            }
                                        }
                                    } catch (e) {
                                        console.log("Error detectando zoom:", e);
                                        // Fallback: mostrar controles de todas formas
                                        setHasZoomMethods(true);
                                    }
                                }, 500);
                            })
                            .catch(console.warn);
                    })
                    .catch(err => {
                        console.error("Error cámara:", err);
                        alert("No se pudo iniciar la cámara. Verifica permisos.");
                        setIsScanning(false);
                    });
                };

                Html5Qrcode.getCameras().then(devices => {
                    if (devices && devices.length) {
                        let bestCamera = devices.find(d => {
                            const label = d.label.toLowerCase();
                            return label.includes('back') && !label.includes('ultra') && !label.includes('0,5');
                        });
                        if (!bestCamera) bestCamera = devices.find(d => d.label.toLowerCase().includes('back'));
                        startScanning(bestCamera ? bestCamera.id : devices[devices.length - 1].id);
                    } else {
                         startScanning({ facingMode: "environment" });
                    }
                }).catch(() => startScanning({ facingMode: "environment" }));

            }, 300);
            return () => clearTimeout(timer);
        }

        return () => {
            if (html5QrCode) {
                try { html5QrCode.stop().catch(() => {}); } catch (e) {}
            }
        };
    }, [isScanning, setIsScanning, onScan]);

    const handleZoom = (e) => {
        const val = parseFloat(e.target.value);
        setZoom(val);
        try {
            const video = document.querySelector('#reader-modal-unique video');
            if (video && video.srcObject) {
                const track = video.srcObject.getVideoTracks()[0];
                track.applyConstraints({ advanced: [{ zoom: val }] }).catch(console.warn);
            }
        } catch (err) { console.warn(err); }
    };

    if (!isScanning) return null;

    // Portal - Layout Modal Optimizado CON UNIQUE CSS
    return createPortal(
        <div className="scanner-overlay-fixed">
            <div className="scanner-modal-card">
                
                {/* Header */}
                <div className="scanner-modal-header">
                    <span className="scanner-title">ESCANEAR CÓDIGO</span>
                    <button 
                        onClick={() => setIsScanning(false)} 
                        className="scanner-close-button"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Camara */}
                <div className="scanner-camera-area">
                     <div id="reader-modal-unique"></div> 
                     
                     <div className="scanner-guide-overlay">
                        <div className="scanner-guide-box">
                            <div className="scanner-laser"></div>
                            {/* Esquinas decorativas */}
                            <div style={{position:'absolute', top:0, left:0, width:'20px', height:'20px', borderTop:'4px solid #10b981', borderLeft:'4px solid #10b981', borderTopLeftRadius:'8px'}}></div>
                            <div style={{position:'absolute', top:0, right:0, width:'20px', height:'20px', borderTop:'4px solid #10b981', borderRight:'4px solid #10b981', borderTopRightRadius:'8px'}}></div>
                            <div style={{position:'absolute', bottom:0, left:0, width:'20px', height:'20px', borderBottom:'4px solid #10b981', borderLeft:'4px solid #10b981', borderBottomLeftRadius:'8px'}}></div>
                            <div style={{position:'absolute', bottom:0, right:0, width:'20px', height:'20px', borderBottom:'4px solid #10b981', borderRight:'4px solid #10b981', borderBottomRightRadius:'8px'}}></div>
                        </div>
                     </div>
                </div>

                {/* Controles */}
                <div className="scanner-controls">
                     <div className="scanner-zoom-presets">
                        {[1, 1.5, 2, 2.5, 3].map(z => (
                            <button
                                key={z}
                                onClick={() => handleZoom({ target: { value: z } })}
                                className={`scanner-zoom-btn ${Math.abs(zoom - z) < 0.25 ? 'active' : ''}`}
                            >
                                {z}x
                            </button>
                        ))}
                    </div>

                    <div className="scanner-slider-container">
                        <ZoomOut size={16} className="text-white/40" />
                        <input 
                            type="range"
                            min={1}
                            max={5}
                            step={0.1}
                            value={zoom}
                            onChange={handleZoom}
                            className="scanner-range-input"
                        />
                        <ZoomIn size={16} className="text-white/40" />
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default EscanerBarras;