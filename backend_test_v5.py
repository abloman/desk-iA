import requests
import sys
import json
from datetime import datetime
import time

class AlphaMindV5Tester:
    def __init__(self, base_url="https://marketpro-89.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.test_results = {}

    def log_test(self, name, success, details="", expected_value=None, actual_value=None):
        """Log test results with detailed information"""
        self.tests_run += 1
        result = {
            "name": name,
            "success": success,
            "details": details,
            "expected": expected_value,
            "actual": actual_value,
            "timestamp": datetime.now().isoformat()
        }
        
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
            if expected_value and actual_value:
                print(f"   Expected: {expected_value}, Got: {actual_value}")
        else:
            print(f"❌ {name} - FAILED: {details}")
            if expected_value and actual_value:
                print(f"   Expected: {expected_value}, Got: {actual_value}")
            self.failed_tests.append(result)
        
        self.test_results[name] = result

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True)
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text[:200]}"
                self.log_test(name, False, error_msg)
                return False, {}

        except Exception as e:
            self.log_test(name, False, str(e))
            return False, {}

    def test_authentication(self):
        """Test authentication with provided credentials"""
        print("\n🔍 Testing Authentication...")
        
        # Test with provided credentials
        login_data = {
            "email": "testmode@test.com",
            "password": "test123"
        }
        
        success, response = self.run_test(
            "Login with provided credentials", 
            "POST", 
            "auth/login", 
            200, 
            login_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            print(f"   ✅ Authenticated as: {response['user']['email']}")
            return True
        else:
            print("   ❌ Failed to authenticate with provided credentials")
            return False

    def test_gold_silver_prices(self):
        """Test Gold and Silver price accuracy"""
        print("\n🔍 Testing Gold/Silver Price Accuracy...")
        
        success, markets_data = self.run_test("Get Markets for Price Check", "GET", "markets", 200)
        
        if success and 'markets' in markets_data:
            markets = markets_data['markets']
            
            # Test Gold (XAU/USD) price
            gold_market = next((m for m in markets if m['symbol'] == 'XAU/USD'), None)
            if gold_market:
                gold_price = gold_market['price']
                expected_range = (2000, 3500)  # Based on PRICE_RANGES in server.py
                in_range = expected_range[0] <= gold_price <= expected_range[1]
                
                self.log_test(
                    "Gold (XAU/USD) price in expected range (~$2680)",
                    in_range,
                    f"Price ${gold_price} {'within' if in_range else 'outside'} range ${expected_range[0]}-${expected_range[1]}",
                    "~$2680 range",
                    f"${gold_price}"
                )
                
                # Check if it's close to the target of ~$2680
                close_to_target = abs(gold_price - 2680) <= 200  # Within $200 of target
                self.log_test(
                    "Gold price close to ~$2680 target",
                    close_to_target,
                    f"Price ${gold_price} is {'close to' if close_to_target else 'far from'} $2680 target",
                    "~$2680",
                    f"${gold_price}"
                )
            else:
                self.log_test("Gold (XAU/USD) market found", False, "XAU/USD not found in markets")
            
            # Test Silver (XAG/USD) price
            silver_market = next((m for m in markets if m['symbol'] == 'XAG/USD'), None)
            if silver_market:
                silver_price = silver_market['price']
                expected_range = (20, 50)  # Based on PRICE_RANGES in server.py
                in_range = expected_range[0] <= silver_price <= expected_range[1]
                
                self.log_test(
                    "Silver (XAG/USD) price in expected range (~$31)",
                    in_range,
                    f"Price ${silver_price} {'within' if in_range else 'outside'} range ${expected_range[0]}-${expected_range[1]}",
                    "~$31 range",
                    f"${silver_price}"
                )
                
                # Check if it's close to the target of ~$31
                close_to_target = abs(silver_price - 31.5) <= 10  # Within $10 of target
                self.log_test(
                    "Silver price close to ~$31 target",
                    close_to_target,
                    f"Price ${silver_price} is {'close to' if close_to_target else 'far from'} $31 target",
                    "~$31",
                    f"${silver_price}"
                )
            else:
                self.log_test("Silver (XAG/USD) market found", False, "XAG/USD not found in markets")

    def test_cme_futures_delay(self):
        """Test CME futures 10-minute delay"""
        print("\n🔍 Testing CME Futures 10-Minute Delay...")
        
        # Test CME info endpoint
        success, cme_info = self.run_test("CME Info Endpoint", "GET", "cme-info", 200)
        
        if success:
            delay_minutes = cme_info.get('delay_minutes')
            cme_symbols = cme_info.get('cme_symbols', [])
            
            self.log_test(
                "CME delay is 10 minutes",
                delay_minutes == 10,
                f"Delay is {delay_minutes} minutes",
                "10 minutes",
                f"{delay_minutes} minutes"
            )
            
            expected_cme_symbols = ["ES", "NQ", "CL", "GC", "SI"]
            has_expected_symbols = all(symbol in cme_symbols for symbol in expected_cme_symbols)
            
            self.log_test(
                "CME symbols include ES, NQ futures",
                has_expected_symbols,
                f"Found symbols: {cme_symbols}",
                expected_cme_symbols,
                cme_symbols
            )
        
        # Test chart data for CME futures to verify delay
        for symbol in ["ES", "NQ"]:
            success, chart_data = self.run_test(
                f"Get {symbol} chart data (with delay)", 
                "GET", 
                f"chart-data/{symbol}?period=1d&interval=15m", 
                200
            )
            
            if success and 'data' in chart_data:
                data_points = chart_data['data']
                if data_points:
                    # Check if the latest data point is at least 10 minutes old
                    latest_time = data_points[-1]['time']
                    # Convert to seconds if in milliseconds
                    if latest_time > 1e12:
                        latest_time = latest_time / 1000
                    
                    current_time = datetime.now().timestamp()
                    age_minutes = (current_time - latest_time) / 60
                    
                    has_delay = age_minutes >= 8  # Allow some tolerance (8+ minutes)
                    
                    self.log_test(
                        f"{symbol} data has 10-min delay",
                        has_delay,
                        f"Latest data is {age_minutes:.1f} minutes old",
                        "≥10 minutes delay",
                        f"{age_minutes:.1f} minutes old"
                    )

    def test_trading_modes_sl_multipliers(self):
        """Test different stop loss multipliers for trading modes"""
        print("\n🔍 Testing Trading Modes SL Multipliers...")
        
        # Test modes endpoint
        success, modes_data = self.run_test("Modes Configuration Endpoint", "GET", "modes", 200)
        
        if success:
            modes = modes_data.get('modes', {})
            
            # Check scalping mode (should have sl_mult = 0.5 for tighter SL)
            scalping = modes.get('scalping', {})
            scalping_sl_mult = scalping.get('sl_mult')
            
            self.log_test(
                "Scalping mode has tighter SL (sl_mult=0.5)",
                scalping_sl_mult == 0.5,
                f"Scalping sl_mult is {scalping_sl_mult}",
                "0.5 (tighter SL)",
                str(scalping_sl_mult)
            )
            
            # Check intraday mode (should have sl_mult = 1.0 for normal SL)
            intraday = modes.get('intraday', {})
            intraday_sl_mult = intraday.get('sl_mult')
            
            self.log_test(
                "Intraday mode has normal SL (sl_mult=1.0)",
                intraday_sl_mult == 1.0,
                f"Intraday sl_mult is {intraday_sl_mult}",
                "1.0 (normal SL)",
                str(intraday_sl_mult)
            )
            
            # Check swing mode (should have sl_mult = 1.5 for wider SL)
            swing = modes.get('swing', {})
            swing_sl_mult = swing.get('sl_mult')
            
            self.log_test(
                "Swing mode has wider SL (sl_mult=1.5)",
                swing_sl_mult == 1.5,
                f"Swing sl_mult is {swing_sl_mult}",
                "1.5 (wider SL)",
                str(swing_sl_mult)
            )
            
            # Verify the relationship: scalping < intraday < swing
            if all([scalping_sl_mult, intraday_sl_mult, swing_sl_mult]):
                correct_order = scalping_sl_mult < intraday_sl_mult < swing_sl_mult
                
                self.log_test(
                    "SL multipliers in correct order (scalping < intraday < swing)",
                    correct_order,
                    f"Order: {scalping_sl_mult} < {intraday_sl_mult} < {swing_sl_mult}",
                    "0.5 < 1.0 < 1.5",
                    f"{scalping_sl_mult} < {intraday_sl_mult} < {swing_sl_mult}"
                )

    def test_signal_generation_modes(self):
        """Test signal generation with different modes to verify SL differences"""
        print("\n🔍 Testing Signal Generation with Different Modes...")
        
        test_symbol = "BTC/USD"
        base_analysis_data = {
            "symbol": test_symbol,
            "timeframe": "15min",
            "market_type": "crypto",
            "strategy": "smc"
        }
        
        mode_results = {}
        
        # Test each mode
        for mode in ["scalping", "intraday", "swing"]:
            print(f"   Testing {mode} mode...")
            analysis_data = {**base_analysis_data, "mode": mode}
            
            success, response = self.run_test(
                f"AI Analysis - {mode} mode", 
                "POST", 
                "ai/analyze", 
                200, 
                analysis_data
            )
            
            if success and 'analysis' in response:
                analysis = response['analysis']
                sl_distance = analysis.get('sl_distance')
                entry_price = analysis.get('optimal_entry')
                sl_price = analysis.get('stop_loss')
                
                mode_results[mode] = {
                    'sl_distance': sl_distance,
                    'entry_price': entry_price,
                    'sl_price': sl_price
                }
                
                print(f"     {mode}: Entry={entry_price}, SL={sl_price}, Distance={sl_distance}")
        
        # Compare SL distances between modes
        if len(mode_results) >= 2:
            scalping_sl = mode_results.get('scalping', {}).get('sl_distance')
            intraday_sl = mode_results.get('intraday', {}).get('sl_distance')
            swing_sl = mode_results.get('swing', {}).get('sl_distance')
            
            if scalping_sl and intraday_sl:
                scalping_tighter = scalping_sl < intraday_sl
                self.log_test(
                    "Scalping SL distance < Intraday SL distance",
                    scalping_tighter,
                    f"Scalping: {scalping_sl}, Intraday: {intraday_sl}",
                    "Scalping < Intraday",
                    f"{scalping_sl} vs {intraday_sl}"
                )
            
            if intraday_sl and swing_sl:
                intraday_smaller = intraday_sl < swing_sl
                self.log_test(
                    "Intraday SL distance < Swing SL distance",
                    intraday_smaller,
                    f"Intraday: {intraday_sl}, Swing: {swing_sl}",
                    "Intraday < Swing",
                    f"{intraday_sl} vs {swing_sl}"
                )

    def test_signal_generation_all_markets(self):
        """Test signal generation for all market types"""
        print("\n🔍 Testing Signal Generation for All Markets...")
        
        market_tests = [
            {"symbol": "BTC/USD", "market_type": "crypto"},
            {"symbol": "EUR/USD", "market_type": "forex"},
            {"symbol": "US500", "market_type": "indices"},
            {"symbol": "XAU/USD", "market_type": "metals"},
            {"symbol": "ES", "market_type": "futures"}
        ]
        
        for test_case in market_tests:
            analysis_data = {
                "symbol": test_case["symbol"],
                "timeframe": "15min",
                "market_type": test_case["market_type"],
                "mode": "intraday",
                "strategy": "smc"
            }
            
            success, response = self.run_test(
                f"Signal Generation - {test_case['market_type']} ({test_case['symbol']})", 
                "POST", 
                "ai/analyze", 
                200, 
                analysis_data
            )
            
            if success and 'analysis' in response:
                analysis = response['analysis']
                signal = analysis.get('signal')
                confidence = analysis.get('confidence')
                
                # Verify signal has required fields
                required_fields = ['signal', 'confidence', 'optimal_entry', 'stop_loss', 'take_profit_1']
                has_required_fields = all(field in analysis for field in required_fields)
                
                self.log_test(
                    f"{test_case['symbol']} signal has required fields",
                    has_required_fields,
                    f"Missing fields: {[f for f in required_fields if f not in analysis]}",
                    "All required fields present",
                    f"Fields present: {list(analysis.keys())}"
                )

    def test_trade_execution(self):
        """Test trade execution functionality"""
        print("\n🔍 Testing Trade Execution...")
        
        # Create a test trade
        trade_data = {
            "symbol": "BTC/USD",
            "direction": "BUY",
            "entry_price": 67500.0,
            "quantity": 1.0,
            "stop_loss": 65000.0,
            "take_profit": 70000.0,
            "strategy": "smc"
        }
        
        success, trade_response = self.run_test("Create Trade", "POST", "trades", 200, trade_data)
        
        if success and 'id' in trade_response:
            trade_id = trade_response['id']
            print(f"   Created trade with ID: {trade_id}")
            
            # Test getting trades to verify it appears
            success, trades_data = self.run_test("Get Trades After Creation", "GET", "trades", 200)
            
            if success:
                trades = trades_data.get('trades', [])
                created_trade = next((t for t in trades if t['id'] == trade_id), None)
                
                self.log_test(
                    "Created trade appears in trades list",
                    created_trade is not None,
                    f"Trade {trade_id} {'found' if created_trade else 'not found'} in trades list"
                )
                
                if created_trade:
                    # Verify trade has floating PnL calculation
                    has_floating_pnl = 'floating_pnl' in created_trade
                    self.log_test(
                        "Trade has floating PnL calculation",
                        has_floating_pnl,
                        f"Floating PnL: {created_trade.get('floating_pnl', 'N/A')}"
                    )
            
            # Test closing the trade
            success, close_response = self.run_test(
                "Close Trade at Market", 
                "POST", 
                f"trades/{trade_id}/close-at-market", 
                200
            )
            
            if success:
                pnl = close_response.get('pnl')
                self.log_test(
                    "Trade closed successfully with PnL calculation",
                    pnl is not None,
                    f"PnL: ${pnl}"
                )

    def test_emergent_llm_integration(self):
        """Test that EMERGENT_LLM_KEY is working"""
        print("\n🔍 Testing EMERGENT LLM Integration...")
        
        # Generate a signal which should use Claude if the key is working
        analysis_data = {
            "symbol": "BTC/USD",
            "timeframe": "15min",
            "market_type": "crypto",
            "mode": "intraday",
            "strategy": "smc"
        }
        
        print("   Testing Claude integration (may take 10-30 seconds)...")
        success, response = self.run_test(
            "AI Analysis with Claude Integration", 
            "POST", 
            "ai/analyze", 
            200, 
            analysis_data
        )
        
        if success and 'analysis' in response:
            analysis = response['analysis']
            reasoning = analysis.get('reasoning', '')
            confidence = analysis.get('confidence', 0)
            
            # Check if reasoning contains Claude-like analysis (French text, detailed analysis)
            has_detailed_reasoning = len(reasoning) > 50 and any(word in reasoning.lower() for word in ['signal', 'analyse', 'recommandation'])
            
            self.log_test(
                "Claude generates detailed reasoning",
                has_detailed_reasoning,
                f"Reasoning length: {len(reasoning)} chars",
                ">50 chars with analysis keywords",
                f"{len(reasoning)} chars"
            )
            
            # High confidence suggests Claude is working
            high_confidence = confidence >= 70
            self.log_test(
                "AI generates high confidence signals",
                high_confidence,
                f"Confidence: {confidence}%",
                "≥70%",
                f"{confidence}%"
            )

    def run_comprehensive_tests(self):
        """Run all comprehensive tests for v5 requirements"""
        print("🚀 Starting AlphaMind V5 Comprehensive Tests...")
        print(f"Testing against: {self.base_url}")
        print("Focus: Gold/Silver prices, CME delays, SL multipliers, signal generation, trade execution")
        
        try:
            # Authentication first
            if not self.test_authentication():
                print("❌ Cannot continue without authentication")
                return False
            
            # Core v5 requirements
            self.test_gold_silver_prices()
            self.test_cme_futures_delay()
            self.test_trading_modes_sl_multipliers()
            self.test_signal_generation_modes()
            self.test_signal_generation_all_markets()
            self.test_trade_execution()
            self.test_emergent_llm_integration()
            
        except Exception as e:
            print(f"❌ Test suite failed with error: {e}")
            return False
        
        # Print detailed summary
        print(f"\n📊 Comprehensive Test Results:")
        print(f"   Tests run: {self.tests_run}")
        print(f"   Tests passed: {self.tests_passed}")
        print(f"   Tests failed: {len(self.failed_tests)}")
        print(f"   Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests Details:")
            for test in self.failed_tests:
                print(f"   - {test['name']}")
                print(f"     Error: {test['details']}")
                if test['expected'] and test['actual']:
                    print(f"     Expected: {test['expected']}")
                    print(f"     Actual: {test['actual']}")
        
        # Summary by category
        categories = {
            "Authentication": ["Login"],
            "Price Accuracy": ["Gold", "Silver"],
            "CME Delays": ["CME", "delay", "ES", "NQ"],
            "SL Multipliers": ["SL", "scalping", "intraday", "swing"],
            "Signal Generation": ["Signal", "Analysis"],
            "Trade Execution": ["Trade", "Create", "Close"],
            "LLM Integration": ["Claude", "reasoning"]
        }
        
        print(f"\n📋 Results by Category:")
        for category, keywords in categories.items():
            category_tests = [t for name, t in self.test_results.items() 
                            if any(keyword.lower() in name.lower() for keyword in keywords)]
            if category_tests:
                passed = sum(1 for t in category_tests if t['success'])
                total = len(category_tests)
                print(f"   {category}: {passed}/{total} ({(passed/total*100):.0f}%)")
        
        return len(self.failed_tests) == 0

def main():
    tester = AlphaMindV5Tester()
    success = tester.run_comprehensive_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())