import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, LineStyle } from 'lightweight-charts';

const TradingChart = ({ symbol, signal, trades = [] }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const linesRef = useRef({ entry: null, sl: null, tp: null });
  const [currentPrice, setCurrentPrice] = useState(null);

  // Generate realistic candle data
  const generateCandleData = (basePrice, count = 200) => {
    const data = [];
    let price = basePrice;
    const now = Math.floor(Date.now() / 1000);
    const interval = 900; // 15 min candles
    
    for (let i = count; i >= 0; i--) {
      const volatility = basePrice * 0.002; // 0.2% volatility
      const open = price;
      const change = (Math.random() - 0.48) * volatility; // Slight bullish bias
      const high = open + Math.random() * volatility;
      const low = open - Math.random() * volatility;
      const close = open + change;
      
      data.push({
        time: now - (i * interval),
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(Math.max(high, open, close).toFixed(2)),
        low: parseFloat(Math.min(low, open, close).toFixed(2)),
        close: parseFloat(close.toFixed(2)),
      });
      
      price = close;
    }
    setCurrentPrice(price);
    return data;
  };

  // Get base price for symbol
  const getBasePrice = (sym) => {
    const prices = {
      'BTC/USD': 87000, 'ETH/USD': 2900, 'SOL/USD': 195, 'XRP/USD': 2.35, 'ADA/USD': 1.05,
      'EUR/USD': 1.052, 'GBP/USD': 1.268, 'USD/JPY': 154.5, 'AUD/USD': 0.638, 'USD/CHF': 0.892,
      'US30': 44250, 'US100': 21650, 'US500': 6050, 'GER40': 20350, 'UK100': 8150,
      'XAU/USD': 2680, 'XAG/USD': 31.5, 'XPT/USD': 995, 'XPD/USD': 1050,
      'ES': 6050, 'NQ': 21650, 'CL': 72.5, 'GC': 2680, 'SI': 31.5
    };
    return prices[sym] || 100;
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 450,
      crosshair: {
        mode: 1,
        vertLine: { color: '#3b82f6', width: 1, style: LineStyle.Dashed },
        horzLine: { color: '#3b82f6', width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: '#334155',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Create candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    candleSeriesRef.current = candleSeries;

    // Load initial data
    const basePrice = getBasePrice(symbol);
    const data = generateCandleData(basePrice);
    candleSeries.setData(data);

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    // Real-time updates every 2 seconds
    const interval = setInterval(() => {
      if (candleSeriesRef.current) {
        const lastData = data[data.length - 1];
        const volatility = basePrice * 0.0005;
        const newClose = lastData.close + (Math.random() - 0.5) * volatility;
        
        const updatedBar = {
          time: lastData.time,
          open: lastData.open,
          high: Math.max(lastData.high, newClose),
          low: Math.min(lastData.low, newClose),
          close: parseFloat(newClose.toFixed(2)),
        };
        
        candleSeriesRef.current.update(updatedBar);
        setCurrentPrice(newClose);
        data[data.length - 1] = updatedBar;
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [symbol]);

  // Update price lines when signal changes
  useEffect(() => {
    if (!candleSeriesRef.current || !signal) return;

    // Remove old lines
    Object.values(linesRef.current).forEach(line => {
      if (line) candleSeriesRef.current.removePriceLine(line);
    });

    // Create new lines
    if (signal.entry) {
      linesRef.current.entry = candleSeriesRef.current.createPriceLine({
        price: signal.entry,
        color: '#3b82f6',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'ENTRY',
      });
    }

    if (signal.sl) {
      linesRef.current.sl = candleSeriesRef.current.createPriceLine({
        price: signal.sl,
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'SL',
      });
    }

    if (signal.tp) {
      linesRef.current.tp = candleSeriesRef.current.createPriceLine({
        price: signal.tp,
        color: '#10b981',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'TP',
      });
    }
  }, [signal]);

  // Add trade lines
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    trades.filter(t => t.status === 'open').forEach(trade => {
      // These lines are in addition to signal lines
      candleSeriesRef.current.createPriceLine({
        price: trade.entry_price,
        color: trade.direction === 'BUY' ? '#22c55e' : '#f97316',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: `${trade.direction} ${trade.symbol}`,
      });
    });
  }, [trades]);

  return (
    <div className="relative w-full">
      {/* Chart Header */}
      <div className="flex items-center justify-between mb-2 px-2">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white">{symbol}</span>
          {currentPrice && (
            <span className="text-xl font-mono text-sky-400">
              {currentPrice.toFixed(symbol.includes('USD') && currentPrice < 10 ? 4 : 2)}
            </span>
          )}
        </div>
        {signal && (
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-blue-500"></span>
              Entry: <span className="font-mono text-white">{signal.entry?.toFixed(2)}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-red-500 border-dashed"></span>
              SL: <span className="font-mono text-red-400">{signal.sl?.toFixed(2)}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-green-500 border-dashed"></span>
              TP: <span className="font-mono text-green-400">{signal.tp?.toFixed(2)}</span>
            </span>
          </div>
        )}
      </div>
      
      {/* Chart Container */}
      <div ref={chartContainerRef} className="w-full rounded-lg overflow-hidden" />
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2 text-[10px] text-slate-400">
        <span>🟢 Bullish</span>
        <span>🔴 Bearish</span>
        <span>🔵 Entry</span>
        <span className="text-red-400">--- SL</span>
        <span className="text-green-400">--- TP</span>
      </div>
    </div>
  );
};

export default TradingChart;
