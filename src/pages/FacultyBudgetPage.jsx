import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, FileText } from 'lucide-react';

const mockBudgetData = [
    { year: '2560', amount: 12500000, expense: 11800000 },
    { year: '2561', amount: 13200000, expense: 12500000 },
    { year: '2562', amount: 12800000, expense: 12600000 },
    { year: '2563', amount: 11500000, expense: 10200000 },
    { year: '2564', amount: 11000000, expense: 9500000 },
    { year: '2565', amount: 12000000, expense: 11200000 },
    { year: '2566', amount: 13500000, expense: 12800000 },
    { year: '2567', amount: 14000000, expense: 13100000 },
    { year: '2568', amount: 14500000, expense: 8500000 }, // Current year
];

export default function FacultyBudgetPage() {
    // Format currency to THB
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            minimumFractionDigits: 0
        }).format(value);
    };

    return (
        <div className="dashboard-content">
            <header className="page-header">
                <div>
                    <h1>งบประมาณคณะวิทยาศาสตร์</h1>
                    <p>ข้อมูลอ้างอิง ปีงบประมาณ 2560 - ปัจจุบัน</p>
                </div>
                <div className="action-buttons">
                    <button className="btn-outline">
                        <FileText size={16} /> Export Report
                    </button>
                </div>
            </header>

            {/* Summary Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon section-financial">
                        <DollarSign size={24} />
                    </div>
                    <div className="stat-info">
                        <h3>งบประมาณปี 2568</h3>
                        <div className="value">{formatCurrency(14500000)}</div>
                        <span className="trend positive">
                            <TrendingUp size={14} /> +3.5% จากปีก่อน
                        </span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon section-financial">
                        <TrendingDown size={24} />
                    </div>
                    <div className="stat-info">
                        <h3>ใช้จ่ายจริง (ถึงปัจจุบัน)</h3>
                        <div className="value">{formatCurrency(8500000)}</div>
                        <span className="trend neutral">
                            58.6% ของงบประมาณ
                        </span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon section-financial">
                        <DollarSign size={24} />
                    </div>
                    <div className="stat-info">
                        <h3>คงเหลือ</h3>
                        <div className="value">{formatCurrency(6000000)}</div>
                        <span className="trend positive">
                            เพียงพอสำหรับไตรมาสที่เหลือ
                        </span>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="content-card full-width">
                <div className="card-header">
                    <h3>แนวโน้มงบประมาณและการใช้จ่าย (2560 - ปัจจุบัน)</h3>
                </div>
                <div style={{ height: '400px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={mockBudgetData}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="year" />
                            <YAxis tickFormatter={(value) => `${value / 1000000}M`} />
                            <Tooltip
                                formatter={(value) => formatCurrency(value)}
                                labelFormatter={(label) => `ปีงบประมาณ ${label}`}
                            />
                            <Legend />
                            <Bar dataKey="amount" name="ได้รับจัดสรร" fill="#2E86AB" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="expense" name="ใช้จ่ายจริง" fill="#E91E63" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Data Table */}
            <div className="content-card full-width">
                <div className="card-header">
                    <h3>รายละเอียดงบประมาณรายปี</h3>
                </div>
                <div className="table-responsive">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>ปีงบประมาณ</th>
                                <th>ได้รับจัดสรร (บาท)</th>
                                <th>ใช้จ่ายจริง (บาท)</th>
                                <th>คงเหลือ (บาท)</th>
                                <th>% การใช้จ่าย</th>
                                <th>สถานะ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...mockBudgetData].reverse().map((row) => (
                                <tr key={row.year}>
                                    <td>{row.year}</td>
                                    <td>{formatCurrency(row.amount)}</td>
                                    <td>{formatCurrency(row.expense)}</td>
                                    <td>{formatCurrency(row.amount - row.expense)}</td>
                                    <td>{((row.expense / row.amount) * 100).toFixed(1)}%</td>
                                    <td>
                                        <span className={`status-badge ${row.year === '2568' ? 'active' : 'completed'}`}>
                                            {row.year === '2568' ? 'ดำเนินการอยู่' : 'สิ้นสุดปีงบ'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
