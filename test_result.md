#====================================================================================================
# Testing Protocol - DO NOT EDIT
#====================================================================================================

user_problem_statement: |
  Alphamind Trading Assistant v5 - Professional Trading Platform:
  - TradingView charts with ALL drawing tools for ALL markets
  - Real price data from Yahoo Finance for all assets
  - Signal with OPTIMAL ENTRY (not current price) based on:
    - Last BOS (Break of Structure)
    - Discount/Premium zones
    - Order Blocks
    - Market context
  - Trade execution at current market price
  - SL behind real swing points
  - TP targeting real liquidity zones
  - RR coherent with mode and timeframe

backend:
  - task: "Yahoo Finance Integration for All Markets"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Yahoo Finance provides real OHLC data for Crypto, Forex, Indices, Metals, Futures"

  - task: "Optimal Entry Calculation"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Entry based on Fib levels (61.8% discount for BUY), Order Blocks, and price position"

  - task: "BOS and Order Block Detection"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true

  - task: "Entry Type (LIMIT vs MARKET)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true

frontend:
  - task: "TradingView Charts for All Markets"
    implemented: true
    working: true
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Using free TradingView symbols: FX_IDC for Forex, ETF proxies for Futures/Metals/Indices"

  - task: "Signal Panel with Optimal Entry"
    implemented: true
    working: true
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Shows Current Price + Optimal Entry + Entry Type (LIMIT/MARKET) + BOS + OB info"

metadata:
  created_by: "main_agent"
  version: "5.0"
  test_sequence: 4
  run_ui: true

test_plan:
  current_focus:
    - "All market charts display correctly"
    - "Optimal entry different from current price when applicable"
    - "Entry type LIMIT/MARKET displayed correctly"
    - "Structure analysis (BOS, OB) visible"
  stuck_tasks: []
  test_all: true
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      MAJOR UPDATE v5 - All Markets + Optimal Entry:
      
      1. CHARTS: All markets now have working TradingView charts
         - Crypto: Binance (free)
         - Forex: FX_IDC (free)
         - Indices: ETF proxies (DIA, QQQ, SPY)
         - Metals: ETF proxies (GLD, SLV)
         - Futures: ETF proxies (SPY, QQQ, USO)
         
      2. REAL DATA: Yahoo Finance integration for all symbols
         
      3. OPTIMAL ENTRY:
         - Signal shows BOTH current price AND optimal entry
         - Entry type: LIMIT (wait for better price) or MARKET (enter now)
         - Based on: Fib 61.8% retracement, Order Blocks, Price position
         
      4. STRUCTURE ANALYSIS:
         - BOS (Break of Structure) detection
         - Order Block identification
         - Trend + Price Position (DISCOUNT/PREMIUM/EQUILIBRIUM)
      
      TESTED MANUALLY:
      - BTC/USD: Working with optimal entry at OB zone
      - EUR/USD: Working with FX_IDC chart
      - XAU/USD: Working with GLD chart
      - NQ: Working with QQQ chart
      
      Test credentials: newtrader2024@test.com / password123
