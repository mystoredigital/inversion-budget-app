import React, { useState, useEffect, useRef } from 'react';
import { supabase, Expense } from '../lib/supabase';
import { X, UploadCloud, CheckCircle2, Image as ImageIcon, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { formatCurrency } from '../lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { addMonths, addYears } from 'date-fns';

type PaymentConfirmModalProps = {
    expense: Expense | null;
    onClose: () => void;
    onSuccess: () => void;
};

export default function PaymentConfirmModal({ expense, onClose, onSuccess }: PaymentConfirmModalProps) {
    const { user } = useAuth();
    const { settings } = useSettings();
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const isSubmitting = useRef(false);

    useEffect(() => {
        // Reset state when opened
        if (expense) {
            setFile(null);
            setPreview(null);
            setPaymentDate(new Date().toISOString().split('T')[0]);
            isSubmitting.current = false;
        }
    }, [expense]);

    useEffect(() => {
        // Escuchar el evento de pegar (Clipboard) globalmente cuando el modal está abierto
        const handlePaste = (e: ClipboardEvent) => {
            if (!expense) return;
            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                        setFile(blob);
                        setPreview(URL.createObjectURL(blob));
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [expense]);

    if (!expense) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selected = e.target.files[0];
            setFile(selected);
            setPreview(URL.createObjectURL(selected));
        }
    };

    const handleConfirm = async () => {
        if (isSubmitting.current) return;
        isSubmitting.current = true;
        setLoading(true);
        try {
            if (!user) throw new Error('Usuario no autenticado');

            // 1. Subir archivo si existe
            let comprobanteKey = null;
            if (file) {
                const fileExt = file.name ? file.name.split('.').pop() : 'png';
                const fileName = `${uuidv4()}.${fileExt}`;
                const filePath = `${user.id}/${expense.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('comprobantes')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                // Registrar en tabla expense_files
                const { error: dbError } = await supabase.from('expense_files').insert([{
                    expense_id: expense.id,
                    user_id: user.id,
                    bucket: 'comprobantes',
                    path: filePath,
                    filename: file.name || 'clipboard_image.png',
                    mime_type: file.type,
                    size: file.size
                }]);

                if (dbError) throw dbError;
                comprobanteKey = true;
            }

            // 2. Actualizar estado del pago a 'Pagado'
            // Y actualizar la fecha a la que el usuario seleccionó como "fecha de pago"
            const { data: updatedData, error: updateError } = await supabase
                .from('expenses')
                .update({
                    status: 'Pagado',
                    fecha: paymentDate // Establecemos la fecha en la que realmente se pagó
                })
                .eq('id', expense.id)
                .select()
                .single();

            if (updateError) throw updateError;

            // Trigger sync webhook if configured
            if (settings.webhook_sync) {
                try {
                    await fetch(settings.webhook_sync, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedData),
                    });
                } catch (webhookError) {
                    console.error('No se pudo enviar al webhook de sync:', webhookError);
                }
            }

            // 3. Auto-renovar: crear próximo movimiento si frecuencia != 'Unico'
            if (expense.frecuencia && expense.frecuencia !== 'Unico') {
                const originalDate = expense.fecha ? new Date(expense.fecha + 'T12:00:00') : new Date();
                let nextDate: Date;

                switch (expense.frecuencia) {
                    case 'Mensual':
                        nextDate = addMonths(originalDate, 1);
                        break;
                    case 'Bimestral':
                        nextDate = addMonths(originalDate, 2);
                        break;
                    case 'Trimestral':
                        nextDate = addMonths(originalDate, 3);
                        break;
                    case 'Semestral':
                        nextDate = addMonths(originalDate, 6);
                        break;
                    case 'Anual':
                        nextDate = addYears(originalDate, 1);
                        break;
                    default:
                        nextDate = addMonths(originalDate, 1);
                }

                const nextDateStr = nextDate.toISOString().split('T')[0];

                // Check if a pending renewal already exists for same expense/date to avoid duplicates
                const { data: existing } = await supabase
                    .from('expenses')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('expense', expense.expense)
                    .eq('fecha', nextDateStr)
                    .eq('status', 'Pendiente')
                    .maybeSingle();

                if (!existing) {
                    await supabase.from('expenses').insert([{
                        user_id: user.id,
                        expense: expense.expense,
                        categoria: expense.categoria,
                        status: 'Pendiente',
                        fecha: nextDateStr,
                        valor: expense.valor,
                        moneda: expense.moneda || 'COP',
                        tipo_presupuesto: expense.tipo_presupuesto || 'Personal',
                        frecuencia: expense.frecuencia,
                        cuenta: expense.cuenta || '',
                        nombre: expense.nombre || '',
                    }]);
                }
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            alert('Error confirmando pago: ' + err.message);
        } finally {
            setLoading(false);
            isSubmitting.current = false;
        }
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-100 bg-teal-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-teal-900">Confirmar Pago</h2>
                        <p className="text-teal-700/80 text-sm font-medium mt-1">Sube el comprobante de esta transacción</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-teal-100 flex items-center justify-center text-teal-700 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 space-y-6">

                    {/* Resumen de la Inversión */}
                    <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100 flex justify-between items-center">
                        <div>
                            <p className="font-bold text-zinc-900">{expense.expense}</p>
                            <p className="text-zinc-500 text-sm font-medium mt-1">Vence: {expense.fecha || 'Sin fecha'}</p>
                        </div>
                        <p className="font-bold text-xl text-zinc-900">{formatCurrency(expense.valor, expense.moneda)}</p>
                    </div>

                    {/* Selector de Fecha de Pago */}
                    <div>
                        <label className="block text-sm font-semibold text-zinc-700 mb-2">Fecha de Pago de la Transacción</label>
                        <div className="relative">
                            <CalendarIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-teal-600" />
                            <input
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                className="w-full pl-12 pr-5 py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none text-zinc-800 font-medium"
                            />
                        </div>
                        {expense.frecuencia && expense.frecuencia !== 'Unico' && (
                            <p className="text-xs text-teal-600 mt-2 font-medium">Se auto-programará el pago siguiente conservando el mismo día de la fecha de vencimiento original ({expense.fecha || paymentDate}).</p>
                        )}
                    </div>

                    {/* Área de Drop / Paste */}
                    <div>
                        <label className="block text-sm font-semibold text-zinc-700 mb-2">Comprobante (Opcional)</label>
                        <div className={`border-2 border-dashed rounded-[24px] p-6 text-center transition-colors ${preview ? 'border-teal-500 bg-teal-50/30' : 'border-zinc-200 hover:border-teal-400 bg-zinc-50'}`}>

                            {preview ? (
                                <div className="relative inline-block">
                                    <img src={preview} alt="Comprobante preview" className="max-h-48 rounded-xl shadow-sm border border-zinc-100" />
                                    <button onClick={() => { setFile(null); setPreview(null); }} className="absolute -top-3 -right-3 bg-rose-500 text-white p-1.5 rounded-full shadow-md hover:bg-rose-600 transition-colors">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="w-12 h-12 bg-white rounded-full shadow-sm border border-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
                                        <ImageIcon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-zinc-600 font-medium text-sm">Pega una imagen de tu portapapeles</p>
                                        <p className="text-zinc-400 text-xs mt-1">o selecciona un archivo de tu equipo</p>
                                    </div>
                                    <label className="inline-block px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer shadow-sm transition-colors mt-2">
                                        <UploadCloud className="w-4 h-4 inline-block mr-2" />
                                        Examinar archivo
                                        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="bg-zinc-50 border-t border-zinc-100 p-6 px-8 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-zinc-600 hover:bg-zinc-200 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={handleConfirm} disabled={loading} className="px-6 py-2.5 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-500 shadow-md shadow-teal-500/20 disabled:opacity-50 transition-colors flex items-center gap-2">
                        {loading ? 'Procesando...' : <><CheckCircle2 className="w-5 h-5" /> Confirmar Pago</>}
                    </button>
                </div>

            </div>
        </div>
    );
}
