#====================================================================================================
# Testing Protocol - DO NOT EDIT
#====================================================================================================

user_problem_statement: |
  Alphamind Trading Assistant v4 - Plateforme professionnelle avec:
  - Interface TradingView complète (tous les outils de dessin)
  - Signaux basés sur VRAIES données de marché (CoinGecko OHLC)
  - Analyse de structure réelle (swing highs/lows, support/resistance)
  - Entry au prix marché immédiat
  - SL derrière les vrais swing points
  - TP vers les vraies zones de liquidité
  - RR cohérent selon mode et timeframe

backend:
  - task: "Fetch Real OHLC Data from CoinGecko"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Fetches 7 days of real candle data from CoinGecko API"

  - task: "Real Market Structure Analysis"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Analyzes real swing highs/lows, calculates ATR, identifies trend, support/resistance"

  - task: "Signal Levels Based on Real Structure"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "SL placed below real swing lows for BUY, above real swing highs for SELL. TP targets real liquidity zones."

  - task: "Entry at Current Market Price"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true

frontend:
  - task: "TradingView Full Widget with All Tools"
    implemented: true
    working: true
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Full TradingView widget with trendlines, rectangles, Fibonacci, all timeframes, indicators"

  - task: "Signal Panel with Structure Data"
    implemented: true
    working: true
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Shows Entry/SL/TP/RR and real structure analysis (trend, position, support, resistance, ATR)"

  - task: "Trade Execution at Market Price"
    implemented: true
    working: true
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Fetches current price before trade execution, enters at live market price"

metadata:
  created_by: "main_agent"
  version: "4.0"
  test_sequence: 3
  run_ui: true

test_plan:
  current_focus:
    - "Real market structure analysis"
    - "Signal levels coherence"
    - "Trade execution at market price"
    - "TradingView widget functionality"
  stuck_tasks: []
  test_all: true
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      MAJOR UPDATE v4 - Real Market Structure Analysis:
      
      1. REAL DATA: Fetching actual OHLC candles from CoinGecko API (7 days)
      2. STRUCTURE ANALYSIS: 
         - Identifies real swing highs/lows
         - Calculates actual ATR from price data
         - Determines trend (BULLISH/BEARISH/RANGING)
         - Finds nearest support/resistance levels
         - Identifies liquidity zones
      3. COHERENT SIGNALS:
         - Entry: Current market price
         - SL: Below real swing low (BUY) / Above real swing high (SELL)
         - TP: Targeting real resistance (BUY) / support (SELL)
         - RR: Minimum 2:1, adjusted by mode and timeframe
      4. TRADINGVIEW: Full widget with all drawing tools restored
      
      TEST RESULT: Signal generated for BTC/USD
      - Entry: 85178 (real price)
      - SL: 82869 (below real support at 82614)
      - TP: 89771 (towards real resistance at 87918)
      - RR: 2.8:1
      - Trend: BEARISH, Position: DISCOUNT
      
      Test credentials: newtrader2024@test.com / password123
