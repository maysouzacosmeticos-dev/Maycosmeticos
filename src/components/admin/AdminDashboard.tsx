import { TrendingUp, ShoppingBag, AlertCircle, DollarSign, Activity } from 'lucide-react';
import { useState } from 'react';

interface Props {
  sales: any[];
  customers: any[];
  visitsCount: number;
}

export function AdminDashboard({ sales, customers }: Props) {
  const [period, setPeriod] = useState<'hoje' | '7dias' | '15dias' | 'mes' | 'tudo'>('hoje');

  const filterDate = new Date();
  if (period === '7dias') filterDate.setDate(filterDate.getDate() - 7);
  if (period === '15dias') filterDate.setDate(filterDate.getDate() - 15);
  if (period === 'mes') filterDate.setDate(1); 
  filterDate.setHours(0,0,0,0);
  
  const filteredSales = sales.filter(s => {
    if (period === 'tudo') return true;
    if (period === 'hoje') return new Date(s.date).toLocaleDateString('pt-BR') === new Date().toLocaleDateString('pt-BR');
    return new Date(s.date) >= filterDate;
  });
  
  const faturamentoCartao = filteredSales.filter(s => s.method === 'Cartão' || s.method === 'InfinitePay' || s.method === 'Online').reduce((a, b) => a + (b.amountPaid || b.total), 0);
  const faturamentoPix = filteredSales.filter(s => s.method === 'Pix').reduce((a, b) => a + (b.amountPaid || b.total), 0);
  const faturamentoDinheiro = filteredSales.filter(s => s.method === 'Dinheiro').reduce((a, b) => a + (b.amountPaid || b.total), 0);
  
  const totalFaturamento = faturamentoCartao + faturamentoPix + faturamentoDinheiro;
  
  // Calculate costs only for non-pending and non-canceled sales to get real profit
  const completedSales = filteredSales.filter(s => s.status !== 'pendente' && s.status !== 'cancelado');
  
  let totalCost = 0;
  completedSales.forEach(sale => {
    if (sale.items) {
      sale.items.forEach((item: any) => {
        totalCost += (item.cost || 0) * item.quantity;
      });
    }
  });

  // Profit is calculated by taking the paid amount for completed sales minus the total cost of those sales
  const actualFaturamentoCompleted = completedSales.reduce((a, b) => a + (b.amountPaid || b.total), 0);
  const liquidProfit = actualFaturamentoCompleted - totalCost;

  const pedidosPendentes = sales.filter(s => s.status === 'pendente').length;
  const totalInadimplente = customers.reduce((acc, c) => acc + (c.totalDivida || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div style={{ background: 'var(--gradient-gold)', padding: '30px', borderRadius: '16px', boxShadow: 'var(--shadow-glass)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: '0 0 10px 0', fontSize: '1.8rem' }}>Olá, May! 👋</h2>
          <p style={{ margin: 0, opacity: 0.9 }}>Aqui está o resumo financeiro do seu negócio.</p>
        </div>
        <select value={period} onChange={(e) => setPeriod(e.target.value as any)} style={{ padding: '10px 15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.5)', background: 'rgba(0,0,0,0.1)', color: 'white', fontWeight: 'bold', outline: 'none', cursor: 'pointer', fontSize: '1rem' }}>
          <option value="hoje" style={{ color: 'black' }}>Somente Hoje</option>
          <option value="7dias" style={{ color: 'black' }}>Últimos 7 dias</option>
          <option value="15dias" style={{ color: 'black' }}>Últimos 15 dias</option>
          <option value="mes" style={{ color: 'black' }}>Este Mês</option>
          <option value="tudo" style={{ color: 'black' }}>Todo o Período</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
        <DashboardCard icon={<TrendingUp />} title="Faturamento Bruto" value={`R$ ${totalFaturamento.toFixed(2)}`} color="#4CAF50" />
        <DashboardCard icon={<DollarSign />} title="Custo de Mercadoria" value={`R$ ${totalCost.toFixed(2)}`} color="#F44336" />
        <DashboardCard icon={<Activity />} title="Lucro Líquido" value={`R$ ${liquidProfit.toFixed(2)}`} color="#2196F3" />
        <DashboardCard icon={<ShoppingBag />} title="Pedidos Pendentes" value={pedidosPendentes} color="#FF9800" />
        <DashboardCard icon={<AlertCircle />} title="A Receber (Fiado)" value={`R$ ${totalInadimplente.toFixed(2)}`} color="#F44336" />
      </div>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }}>
        <h3 style={{ margin: '0 0 15px 0' }}>Detalhamento do Caixa ({period === 'hoje' ? 'Hoje' : 'Período Selecionado'})</h3>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <CashCard title="Cartão / Link" amount={faturamentoCartao} bg="#e3f2fd" color="#1565c0" />
          <CashCard title="Pix" amount={faturamentoPix} bg="#e0f2f1" color="#00695c" />
          <CashCard title="Dinheiro" amount={faturamentoDinheiro} bg="#fff3e0" color="#ef6c00" />
        </div>
      </div>

    </div>
  );
}

function DashboardCard({ icon, title, value, color }: { icon: any, title: string, value: string | number, color: string }) {
  return (
    <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: 'var(--shadow-card)', display: 'flex', alignItems: 'center', gap: '15px' }}>
      <div style={{ background: `${color}20`, color: color, padding: '15px', borderRadius: '12px', display: 'flex' }}>
        {icon}
      </div>
      <div>
        <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>{title}</p>
        <h3 style={{ margin: '5px 0 0 0', fontSize: '1.4rem', color: '#333' }}>{value}</h3>
      </div>
    </div>
  );
}

function CashCard({ title, amount, bg, color }: { title: string, amount: number, bg: string, color: string }) {
  return (
    <div style={{ flex: '1 1 150px', background: bg, padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
      <p style={{ margin: 0, color, fontWeight: 'bold' }}>{title}</p>
      <h2 style={{ margin: '10px 0 0 0', color }}>R$ {amount.toFixed(2)}</h2>
    </div>
  );
}
