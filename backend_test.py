import requests
import sys
import json
from datetime import datetime

class AlphaMindAPITester:
    def __init__(self, base_url="https://alphamind-trader.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.created_trade_id = None

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
            self.failed_tests.append({"test": name, "error": details})

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

    def test_health_check(self):
        """Test basic health endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        self.run_test("API Root", "GET", "", 200)
        self.run_test("Health Check", "GET", "health", 200)

    def test_authentication(self):
        """Test authentication flow"""
        print("\n🔍 Testing Authentication...")
        
        # Test login with provided credentials first
        login_data = {
            "email": "newtrader2024@test.com",
            "password": "password123"
        }
        
        success, response = self.run_test(
            "User Login (Provided Credentials)", 
            "POST", 
            "auth/login", 
            200, 
            login_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            print(f"   Using provided credentials token: {self.token[:20]}...")
        else:
            # Fallback: Test registration with new user
            test_email = f"test_{datetime.now().strftime('%H%M%S')}@alphamind.com"
            register_data = {
                "email": test_email,
                "password": "test123",
                "name": "Test User"
            }
            
            success, response = self.run_test(
                "User Registration (Fallback)", 
                "POST", 
                "auth/register", 
                200, 
                register_data
            )
            
            if success and 'token' in response:
                self.token = response['token']
                self.user_id = response['user']['id']
                print(f"   Token obtained via registration: {self.token[:20]}...")
        
        # Test get current user
        if self.token:
            self.run_test("Get Current User", "GET", "auth/me", 200)

    def test_markets(self):
        """Test market data endpoints"""
        print("\n🔍 Testing Market Data...")
        
        success, markets_data = self.run_test("Get Markets", "GET", "markets", 200)
        
        if success and 'markets' in markets_data:
            markets = markets_data['markets']
            print(f"   Found {len(markets)} markets")
            
            # Test market types - updated to match actual implementation
            crypto_markets = [m for m in markets if m['type'] == 'crypto']
            forex_markets = [m for m in markets if m['type'] == 'forex']
            indices_markets = [m for m in markets if m['type'] == 'indices']
            metals_markets = [m for m in markets if m['type'] == 'metals']
            futures_markets = [m for m in markets if m['type'] == 'futures']
            
            print(f"   Crypto: {len(crypto_markets)}, Forex: {len(forex_markets)}")
            print(f"   Indices: {len(indices_markets)}, Metals: {len(metals_markets)}, Futures: {len(futures_markets)}")
            
            # Test individual price endpoint
            if markets:
                test_symbol = markets[0]['symbol']
                # URL encode the symbol for path parameter
                encoded_symbol = test_symbol.replace('/', '%2F')
                self.run_test(
                    f"Get Price ({test_symbol})", 
                    "GET", 
                    f"price/{encoded_symbol}", 
                    200
                )

    def test_ai_analysis(self):
        """Test AI analysis endpoints"""
        print("\n🔍 Testing AI Analysis...")
        
        analysis_data = {
            "symbol": "BTC/USD",
            "timeframe": "15min",
            "market_type": "crypto",
            "mode": "intraday",
            "strategy": "smc"
        }
        
        # Note: This might take longer due to Claude API call
        print("   Note: AI analysis may take 10-30 seconds...")
        success, response = self.run_test(
            "AI Analysis (BTC/USD)", 
            "POST", 
            "ai/analyze", 
            200, 
            analysis_data
        )
        
        if success:
            print(f"   Analysis completed for {response.get('symbol', 'unknown')}")
            if 'analysis' in response:
                analysis = response['analysis']
                print(f"   Signal: {analysis.get('signal', 'N/A')}")
                print(f"   Confidence: {analysis.get('confidence', 'N/A')}%")
                print(f"   Entry: {analysis.get('entry_price', 'N/A')}")
        
        # Test Futures market analysis
        futures_data = {
            "symbol": "ES",
            "timeframe": "15min", 
            "market_type": "futures",
            "mode": "intraday",
            "strategy": "ict"
        }
        
        success, response = self.run_test(
            "AI Analysis (ES Futures)", 
            "POST", 
            "ai/analyze", 
            200, 
            futures_data
        )
        
        if success:
            print(f"   Futures analysis completed for {response.get('symbol', 'unknown')}")

    def test_signals(self):
        """Test signals endpoints"""
        print("\n🔍 Testing Signals...")
        
        # Get existing signals
        success, signals_data = self.run_test("Get Signals", "GET", "signals", 200)
        
        if success:
            signals = signals_data.get('signals', [])
            print(f"   Found {len(signals)} existing signals")

    def test_portfolio(self):
        """Test portfolio endpoints"""
        print("\n🔍 Testing Portfolio...")
        
        success, portfolio_data = self.run_test("Get Portfolio", "GET", "portfolio", 200)
        
        if success:
            print(f"   Balance: ${portfolio_data.get('balance', 0)}")
            print(f"   Total PnL: ${portfolio_data.get('total_pnl', 0)}")
            print(f"   Win Rate: {portfolio_data.get('win_rate', 0)}%")

    def test_trades(self):
        """Test trading endpoints"""
        print("\n🔍 Testing Trades...")
        
        # Get existing trades
        success, trades_data = self.run_test("Get Trades", "GET", "trades", 200)
        
        if success:
            trades = trades_data.get('trades', [])
            print(f"   Found {len(trades)} existing trades")
            
            # Check for open trades with floating PnL
            open_trades = [t for t in trades if t.get('status') == 'open']
            if open_trades:
                print(f"   Open trades: {len(open_trades)}")
                for trade in open_trades[:2]:  # Show first 2
                    pnl = trade.get('floating_pnl', 0)
                    print(f"     {trade.get('symbol')} {trade.get('direction')}: PnL ${pnl}")
        
        # Create a test trade
        trade_data = {
            "signal_id": "test-signal-123",
            "symbol": "BTC/USD",
            "direction": "BUY",
            "entry_price": 67500.0,
            "quantity": 1.0,
            "stop_loss": 65000.0,
            "take_profit": 70000.0,
            "strategy": "smc"
        }
        
        success, trade_response = self.run_test("Create Trade", "POST", "trades", 201, trade_data)
        
        if success and 'id' in trade_response:
            trade_id = trade_response['id']
            self.created_trade_id = trade_id
            print(f"   Created trade with ID: {trade_id}")
            
            # Test different close methods
            self.run_test(
                "Close Trade at Market", 
                "POST", 
                f"trades/{trade_id}/close-at-market", 
                200
            )

    def test_bot_config(self):
        """Test bot configuration endpoints"""
        print("\n🔍 Testing Bot Configuration...")
        
        # Get current config
        success, config_data = self.run_test("Get Bot Config", "GET", "bot/config", 200)
        
        if success:
            print(f"   Bot enabled: {config_data.get('enabled', False)}")
        
        # Update config
        new_config = {
            "enabled": True,
            "risk_per_trade": 0.02,
            "max_daily_trades": 5,
            "allowed_markets": ["crypto", "forex"],
            "strategies": ["ICT", "SMC"],
            "auto_execute": False
        }
        
        self.run_test("Update Bot Config", "POST", "bot/config", 200, new_config)

    def test_mt5_connection(self):
        """Test MT5 connection endpoints"""
        print("\n🔍 Testing MT5 Connection...")
        
        # Test MT5 connection
        mt5_data = {
            "server": "ICMarkets-Demo",
            "login": "12345678",
            "password": "testpass123"
        }
        
        self.run_test("Connect MT5", "POST", "bot/connect-mt5", 200, mt5_data)
        
        # Test disconnect
        self.run_test("Disconnect MT5", "POST", "bot/disconnect-mt5", 200)

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting AlphaMind API Tests...")
        print(f"Testing against: {self.base_url}")
        
        try:
            self.test_health_check()
            self.test_authentication()
            
            if not self.token:
                print("❌ Cannot continue without authentication token")
                return False
            
            self.test_markets()
            self.test_portfolio()
            self.test_trades()
            self.test_signals()
            self.test_bot_config()
            self.test_mt5_connection()
            self.test_ai_analysis()  # Last because it's slowest
            
        except Exception as e:
            print(f"❌ Test suite failed with error: {e}")
            return False
        
        # Print summary
        print(f"\n📊 Test Results:")
        print(f"   Tests run: {self.tests_run}")
        print(f"   Tests passed: {self.tests_passed}")
        print(f"   Tests failed: {len(self.failed_tests)}")
        print(f"   Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"   - {test['test']}: {test['error']}")
        
        return len(self.failed_tests) == 0

def main():
    tester = AlphaMindAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())