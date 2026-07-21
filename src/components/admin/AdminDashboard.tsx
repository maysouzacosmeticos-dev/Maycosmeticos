import { TrendingUp, Users, ShoppingBag, AlertCircle } from 'lucide-react';

interface Props {
  sales: any[];
  customers: any[];
  visitsCount: number;
}

export function AdminDashboard({ sales, customers, visitsCount }: Props) {
  const today = new Date().toLocaleDateString('pt-BR');
  
  const todaySales = sales.filter(s => new Date(s.date).toLocaleDateString('pt-BR') === today);
  
  const faturamentoHojeCartao = todaySales.filter(s => s.method === 'Cartão' || s.method === 'InfinitePay' || s.method === 'Online').reduce((a, b) => a + (b.amountPaid || b.total), 0);
  const faturamentoHojePix = todaySales.filter(s => s.method === 'Pix').reduce((a, b) => a + (b.amountPaid || b.total), 0);
  const faturamentoHojeDinheiro = todaySales.filter(s => s.method === 'Dinheiro').reduce((a, b) => a + (b.amountPaid || b.total), 0);
  
  const totalFaturamento = faturamentoHojeCartao + faturamentoHojePix + faturamentoHojeDinheiro;
  const pedidosPendentes = sales.filter(s => s.status === 'pendente').length;
  const totalInadimplente = customers.reduce((acc, c) => acc + (c.totalDivida || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div style={{ background: 'var(--gradient-gold)', padding: '30px', borderRadius: '16px', boxShadow: 'var(--shadow-glass)', color: 'white' }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '1.8rem' }}>Olá, May! 👋</h2>
        <p style={{ margin: 0, opacity: 0.9 }}>Aqui está o resumo do seu negócio hoje.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
        <DashboardCard icon={<TrendingUp />} title="Faturamento Hoje" value={`R$ ${totalFaturamento.toFixed(2)}`} color="#4CAF50" />
        <DashboardCard icon={<ShoppingBag />} title="Pedidos Pendentes" value={pedidosPendentes} color="#FF9800" />
        <DashboardCard icon={<AlertCircle />} title="A Receber (Fiado)" value={`R$ ${totalInadimplente.toFixed(2)}`} color="#F44336" />
        <DashboardCard icon={<Users />} title="Total de Clientes" value={customers.length} color="#2196F3" />
        <DashboardCard icon={<Users />} title="Visitas na Vitrine" value={visitsCount} color="#9C27B0" />
      </div>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }}>
        <h3 style={{ margin: '0 0 15px 0' }}>Detalhamento do Caixa (Hoje)</h3>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <CashCard title="Cartão / Link" amount={faturamentoHojeCartao} bg="#e3f2fd" color="#1565c0" />
          <CashCard title="Pix" amount={faturamentoHojePix} bg="#e0f2f1" color="#00695c" />
          <CashCard title="Dinheiro" amount={faturamentoHojeDinheiro} bg="#fff3e0" color="#ef6c00" />
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
