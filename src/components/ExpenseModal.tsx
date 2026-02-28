import React, { useState, useEffect } from 'react';
import { supabase, Expense } from '../lib/supabase';
import { X, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

type ExpenseModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    expenseToEdit?: Expense | null;
};

export default function ExpenseModal({ isOpen, onClose, onSuccess, expenseToEdit }: ExpenseModalProps) {
    const { user } = useAuth();
    const { settings } = useSettings();
    const [loading, setLoading] = useState(false);

    const defaultForm = {
        expense: '',
        categoria: 'Home',
        status: 'Pendiente',
        fecha: '',
        valor: '',
        moneda: 'COP' as 'COP' | 'USD',
        tipo_presupuesto: 'Personal',
        frecuencia: 'Unico',
        cuenta: '',
        nombre: '',
    };

    const [formData, setFormData] = useState(defaultForm);

    useEffect(() => {
        if (isOpen) {
            if (expenseToEdit) {
                setFormData({
                    expense: expenseToEdit.expense,
                    categoria: expenseToEdit.categoria,
                    status: expenseToEdit.status,
                    fecha: expenseToEdit.fecha || '',
                    valor: String(expenseToEdit.valor),
                    moneda: expenseToEdit.moneda || 'COP',
                    tipo_presupuesto: expenseToEdit.tipo_presupuesto || 'Personal',
                    frecuencia: expenseToEdit.frecuencia || 'Unico',
                    cuenta: expenseToEdit.cuenta || '',
                    nombre: expenseToEdit.nombre || '',
                });
            } else {
                setFormData(defaultForm);
            }
        }
    }, [isOpen, expenseToEdit]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleDelete = async () => {
        if (!expenseToEdit) return;
        const confirmDelete = window.confirm('¿Estás seguro de eliminar esta transacción?');
        if (!confirmDelete) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('expenses')
                .delete()
                .eq('id', expenseToEdit.id);
            if (error) throw error;
            onSuccess();
            onClose();
        } catch (err: any) {
            alert('Error al eliminar: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!user) throw new Error('Usuario no autenticado');

            const payload = {
                user_id: user.id,
                expense: formData.expense,
                categoria: formData.categoria,
                status: formData.status,
                fecha: formData.fecha || null,
                valor: parseFloat(formData.valor) || 0,
                moneda: formData.moneda,
                tipo_presupuesto: formData.tipo_presupuesto,
                frecuencia: formData.frecuencia,
                cuenta: formData.cuenta,
                nombre: formData.nombre,
            };

            let dataResult;

            if (expenseToEdit) {
                // Actualizar
                const { data, error } = await supabase
                    .from('expenses')
                    .update(payload)
                    .eq('id', expenseToEdit.id)
                    .select()
                    .single();
                if (error) throw error;
                dataResult = data;
            } else {
                // Crear
                const { data, error } = await supabase
                    .from('expenses')
                    .insert([payload])
                    .select()
                    .single();
                if (error) throw error;
                dataResult = data;
            }

            // Webhook n8n (opcional)
            const activeWebhook = settings.webhook_sync || 'https://n8n.mystoredigital.cloud/webhook/sync-expense-calendar';
            if (formData.fecha && activeWebhook) {
                try {
                    await fetch(activeWebhook, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dataResult),
                    });
                } catch (webhookError) {
                    console.error('No se pudo contactar al webhook n8n:', webhookError);
                }
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            alert('Error al procesar: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-100">
                    <h2 className="text-2xl font-bold text-zinc-900">
                        {expenseToEdit ? 'Editar Inversión' : 'Agregar Inversión'}
                    </h2>
                    <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-500 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Formulary Body */}
                <div className="p-8 max-h-[70vh] overflow-y-auto">
                    <form id="expense-form" onSubmit={handleSubmit} className="space-y-6">

                        {/* Title & Amount Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-2">Nombre de la Inversión *</label>
                                <input required type="text" name="expense" value={formData.expense} onChange={handleChange} placeholder="Ej. Arriendo, Netflix, Nómina" className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none transition-shadow" />
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-sm font-semibold text-zinc-700 mb-2">Monto (Valor) *</label>
                                    <div className="relative">
                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 font-semibold text-zinc-500">$</span>
                                        <input required type="number" step="0.01" min="0" name="valor" value={formData.valor} onChange={handleChange} placeholder="0.00" className="w-full pl-9 pr-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none transition-shadow" />
                                    </div>
                                </div>
                                <div className="w-28">
                                    <label className="block text-sm font-semibold text-zinc-700 mb-2">Moneda</label>
                                    <select name="moneda" value={formData.moneda} onChange={handleChange} className="w-full px-3 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer text-center font-semibold">
                                        <option value="COP">COP</option>
                                        <option value="USD">USD</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-2">Cuenta u Origen</label>
                                <input type="text" name="cuenta" value={formData.cuenta} onChange={handleChange} placeholder="Ej. Bancolombia" className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none transition-shadow" />
                            </div>
                        </div>

                        {/* Clasification */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-2">Tipo</label>
                                <select name="tipo_presupuesto" value={formData.tipo_presupuesto} onChange={handleChange} className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer">
                                    <option value="Personal">Personal</option>
                                    <option value="Suscripciones">Suscripciones</option>
                                    <option value="Negocios">Negocios</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-2">Categoría</label>
                                <select name="categoria" value={formData.categoria} onChange={handleChange} className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer">
                                    <option value="Home">Home</option>
                                    <option value="Food">Food</option>
                                    <option value="Entertainment">Entertainment</option>
                                    <option value="Salud">Salud</option>
                                    <option value="Servicios">Servicios</option>
                                    <option value="Creditos">Creditos</option>
                                    <option value="Tarjeta de Credito">Tarjeta de Crédito</option>
                                    <option value="Colegio">Colegio</option>
                                    <option value="Business">Business</option>
                                    <option value="Car">Car</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-2">Frecuencia</label>
                                <select name="frecuencia" value={formData.frecuencia} onChange={handleChange} className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer">
                                    <option value="Unico">Único</option>
                                    <option value="Mensual">Mensual</option>
                                    <option value="Bimestral">Bimestral</option>
                                    <option value="Trimestral">Trimestral</option>
                                    <option value="Semestral">Semestral</option>
                                    <option value="Anual">Anual</option>
                                </select>
                            </div>
                        </div>

                        {/* Calendar & Status */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-2">Fecha de Vencimiento / Pago *</label>
                                <input required type="date" name="fecha" value={formData.fecha} onChange={handleChange} className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-2">Estado</label>
                                <div className="flex gap-4 p-1 px-1 py-1 bg-zinc-100 rounded-2xl mt-1">
                                    <button type="button" onClick={() => setFormData({ ...formData, status: 'Pendiente' })} className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${formData.status === 'Pendiente' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}>Pendiente</button>
                                    <button type="button" onClick={() => setFormData({ ...formData, status: 'Pagado' })} className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${formData.status === 'Pagado' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}>Pagado</button>
                                </div>
                            </div>
                        </div>

                    </form>
                </div>

                {/* Footer */}
                <div className="bg-zinc-50 p-6 px-8 border-t border-zinc-100 flex justify-between gap-4">
                    <div>
                        {expenseToEdit && (
                            <button type="button" onClick={handleDelete} className="px-5 py-3 rounded-2xl font-bold text-rose-600 hover:bg-rose-100 transition-colors flex items-center gap-2">
                                <Trash2 className="w-5 h-5" /> Eliminar
                            </button>
                        )}
                    </div>
                    <div className="flex gap-4">
                        <button type="button" onClick={onClose} className="px-6 py-3 rounded-2xl font-bold text-zinc-600 hover:bg-zinc-200 transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" form="expense-form" disabled={loading} className="px-8 py-3 rounded-2xl font-bold text-white bg-teal-900 hover:bg-teal-800 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-md shadow-teal-900/20">
                            {loading ? 'Guardando...' : (expenseToEdit ? 'Guardar Cambios' : 'Crear y Agendar')}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
