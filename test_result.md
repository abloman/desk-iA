#====================================================================================================
# Testing Protocol - DO NOT EDIT
#====================================================================================================

user_problem_statement: |
  Create the best trading assistant "Alphamind" with:
  - All financial markets (Crypto, Forex, Indices, Metals, Futures)
  - Real-time PNL display with fluid updates (every 2 seconds)
  - Entry/SL/TP horizontal lines on chart like TopStep X
  - 5 Advanced strategies: SMC/ICT Avancée, Market Structure, OrderBlock, MA Avancé, OPR
  - Coherent SL/TP based on volatility and market conditions
  - Only manual close button for trades (no SL/TP buttons)
  - Performance page with equity curve, strategy rankings, clear history button
  - MT5 connection ready for Windows deployment

backend:
  - task: "User Authentication"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false

  - task: "5 Advanced Strategies with Volatility-based SL/TP"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Implemented SMC/ICT, Market Structure, OrderBlock, MA Advanced, OPR strategies with ATR-based SL/TP calculation"

  - task: "Futures Market Support"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Added ES, NQ, CL, GC, SI futures symbols"

  - task: "Equity Curve Endpoint"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true

  - task: "Strategy Stats Endpoint"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true

  - task: "Clear History Endpoint"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true

  - task: "MT5 Integration (Windows Ready)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "MT5 code prepared for Windows. Runs in simulation mode on Linux."

frontend:
  - task: "Candlestick Chart with Lightweight Charts"
    implemented: true
    working: true
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "TradingView-style chart with candlesticks, real-time updates every 2 seconds"

  - task: "Entry/SL/TP Horizontal Lines on Chart"
    implemented: true
    working: true
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Horizontal price lines displayed after signal generation like TopStep X"

  - task: "5 Advanced Strategies Dropdown"
    implemented: true
    working: true
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true

  - task: "Futures Market Selection"
    implemented: true
    working: true
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true

  - task: "Trades Table with Only Close Button"
    implemented: true
    working: true
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Removed SL/TP buttons, kept only 'Fermer' button for manual close"

  - task: "Performance Page with Equity Curve"
    implemented: true
    working: true
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true

  - task: "Strategy Rankings"
    implemented: true
    working: true
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true

  - task: "Clear History Button"
    implemented: true
    working: true
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true

  - task: "Fluid PnL Updates (2 seconds)"
    implemented: true
    working: true
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true

metadata:
  created_by: "main_agent"
  version: "3.0"
  test_sequence: 2
  run_ui: true

test_plan:
  current_focus:
    - "Candlestick Chart with Entry/SL/TP lines"
    - "5 Advanced Strategies"
    - "Futures Market"
    - "Equity Curve"
    - "Strategy Rankings"
  stuck_tasks: []
  test_all: true
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      MAJOR UPDATE COMPLETED:
      
      1. CHART: Replaced TradingView iframe with Lightweight Charts candlestick chart
         - Real-time price updates every 2 seconds
         - Entry/SL/TP horizontal lines displayed after signal generation
         
      2. STRATEGIES: Implemented 5 advanced strategies:
         - SMC/ICT Avancée (Smart Money + ICT concepts)
         - Market Structure Avancé (HTF + LTF structure analysis)
         - OrderBlock + Imbalances (FVG detection)
         - Moyenne Mobile Avancé (EMA 9/21/50/200)
         - OPR (Opening Price Range)
         All with ATR-based volatility-aware SL/TP calculation
         
      3. FUTURES: Added ES, NQ, CL, GC, SI symbols to both backend and frontend
      
      4. PERFORMANCE PAGE: 
         - Equity curve chart
         - Strategy rankings with medals (🥇🥈🥉)
         - Clear history button
         
      5. TRADES: Removed SL/TP buttons, kept only manual "Fermer" button
      
      6. MT5: Code prepared for Windows deployment (runs in simulation on Linux)
      
      Please run E2E tests to validate all features.
      
      Test credentials: newtrader2024@test.com / password123
