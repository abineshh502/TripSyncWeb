import os
import sys
import time
import unittest
import pandas as pd
from datetime import datetime
from jinja2 import Template

# Add current directory to path to import test suite
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from test_suite import TripSyncTestSuite

class TestResultCollector(unittest.TestResult):
    def __init__(self):
        super().__init__()
        self.results = []

    def startTest(self, test):
        self.start_time = time.time()
        super().startTest(test)

    def addSuccess(self, test):
        elapsed = time.time() - self.start_time
        category = self.get_category(test)
        self.results.append({
            "Test ID": f"TS_{len(self.results)+1:03d}",
            "Category": category,
            "Test Name": test._testMethodName,
            "Status": "PASS",
            "Duration": round(elapsed, 3),
            "Error Details": ""
        })
        super().addSuccess(test)

    def addFailure(self, test, err):
        elapsed = time.time() - self.start_time
        category = self.get_category(test)
        err_msg = self._exc_info_to_string(err, test)
        self.results.append({
            "Test ID": f"TS_{len(self.results)+1:03d}",
            "Category": category,
            "Test Name": test._testMethodName,
            "Status": "FAIL",
            "Duration": round(elapsed, 3),
            "Error Details": err_msg
        })
        super().addFailure(test, err)

    def addError(self, test, err):
        elapsed = time.time() - self.start_time
        category = self.get_category(test)
        err_msg = self._exc_info_to_string(err, test)
        self.results.append({
            "Test ID": f"TS_{len(self.results)+1:03d}",
            "Category": category,
            "Test Name": test._testMethodName,
            "Status": "ERROR",
            "Duration": round(elapsed, 3),
            "Error Details": err_msg
        })
        super().addError(test, err)

    def get_category(self, test):
        method = getattr(test, test._testMethodName)
        doc = getattr(method, "__doc__", "")
        if doc and "Category:" in doc:
            parts = doc.split("Category:")
            if len(parts) > 1:
                return parts[1].split("-")[0].strip()
        return "General"

def generate_excel_report(results, filename="TripSync_TestReport.xlsx"):
    df = pd.DataFrame(results)
    # Ensure correct columns order
    df = df[["Test ID", "Category", "Test Name", "Status", "Duration", "Error Details"]]
    df.columns = ["Test ID", "Category", "Test Name", "Status", "Duration (s)", "Error Details"]
    df.to_excel(filename, index=False)
    print(f"[SUCCESS] Excel report generated successfully: {filename}")

def generate_html_report(results, total_assertions, start_time, duration, filename="execution-report.html"):
    total_tests = len(results)
    passed = sum(1 for r in results if r["Status"] == "PASS")
    failed = sum(1 for r in results if r["Status"] in ["FAIL", "ERROR"])
    pass_rate = round((passed / total_tests) * 100, 2) if total_tests > 0 else 0.0
    
    # Calculate category breakdowns
    categories = {}
    for r in results:
        cat = r["Category"]
        if cat not in categories:
            categories[cat] = {"total": 0, "passed": 0, "failed": 0}
        categories[cat]["total"] += 1
        if r["Status"] == "PASS":
            categories[cat]["passed"] += 1
        else:
            categories[cat]["failed"] += 1

    # HTML Template
    template_str = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TripSync Web E2E Test Execution Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        body {
            font-family: 'Outfit', sans-serif;
        }
        .glow-teal {
            box-shadow: 0 0 40px -5px rgba(20, 184, 166, 0.15);
        }
    </style>
</head>
<body class="bg-[#0b0f19] text-slate-100 min-h-screen pb-12">
    <!-- Header Banner -->
    <header class="border-b border-white/5 bg-[#0f172a]/60 backdrop-blur-md sticky top-0 z-30">
        <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div class="flex items-center space-x-3">
                <span class="text-2xl">✈️</span>
                <div>
                    <h1 class="text-xl font-bold tracking-tight bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">TripSync Core Web E2E Dashboard</h1>
                    <p class="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Selenium Test Framework v2.0</p>
                </div>
            </div>
            <div class="flex items-center space-x-2 bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 rounded-full text-teal-400 font-semibold text-xs">
                <span class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse mr-1"></span>
                Completed: {{ execution_date }}
            </div>
        </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 mt-8 space-y-8">
        <!-- Stats Summary Widgets -->
        <section class="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div class="bg-[#1e293b]/40 border border-white/5 rounded-2xl p-6 glow-teal">
                <p class="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Test Cases</p>
                <p class="text-white text-4xl font-extrabold mt-2">{{ total_tests }}</p>
                <p class="text-slate-400 text-xs mt-1.5">Executed sequentially</p>
            </div>
            <div class="bg-[#1e293b]/40 border border-white/5 rounded-2xl p-6 glow-teal">
                <p class="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Assertions</p>
                <p class="text-teal-400 text-4xl font-extrabold mt-2">{{ total_assertions }}</p>
                <p class="text-slate-400 text-xs mt-1.5">Selenium verification steps</p>
            </div>
            <div class="bg-[#1e293b]/40 border border-white/5 rounded-2xl p-6 glow-teal">
                <p class="text-slate-500 text-xs font-bold uppercase tracking-wider">Pass Rate Percentage</p>
                <p class="text-emerald-400 text-4xl font-extrabold mt-2">{{ pass_rate }}%</p>
                <p class="text-slate-400 text-xs mt-1.5">{{ passed }} Passed / {{ failed }} Failed</p>
            </div>
            <div class="bg-[#1e293b]/40 border border-white/5 rounded-2xl p-6 glow-teal">
                <p class="text-slate-500 text-xs font-bold uppercase tracking-wider">Execution Time</p>
                <p class="text-white text-4xl font-extrabold mt-2">{{ duration }}s</p>
                <p class="text-slate-400 text-xs mt-1.5">Average {{ avg_duration }}s per test</p>
            </div>
        </section>

        <!-- Charts and Breakdown -->
        <section class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Pie Chart -->
            <div class="bg-[#111827]/40 border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[300px]">
                <h3 class="text-white font-bold text-sm mb-4 self-start">Overall Status</h3>
                <div class="w-48 h-48">
                    <canvas id="statusChart"></canvas>
                </div>
            </div>
            <!-- Category Breakdowns -->
            <div class="lg:col-span-2 bg-[#111827]/40 border border-white/5 rounded-2xl p-6">
                <h3 class="text-white font-bold text-sm mb-4">Category Metrics Breakdown</h3>
                <div class="space-y-4 max-h-[250px] overflow-y-auto pr-2">
                    {% for cat, data in categories.items() %}
                    <div class="space-y-1.5">
                        <div class="flex justify-between text-xs font-semibold text-slate-400">
                            <span>{{ cat }}</span>
                            <span>{{ data.passed }}/{{ data.total }} Passed</span>
                        </div>
                        <div class="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-white/5">
                            <div class="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full" 
                                 style="width: {{ (data.passed / data.total) * 100 }}%"></div>
                        </div>
                    </div>
                    {% endfor %}
                </div>
            </div>
        </section>

        <!-- Metadata & Environment Information -->
        <section class="bg-[#1e293b]/20 border border-white/5 rounded-2xl p-6">
            <h3 class="text-white font-bold text-sm mb-4">Build & Execution Metadata</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs text-slate-400">
                <div>
                    <p class="text-slate-500 font-bold uppercase">System OS</p>
                    <p class="text-white font-semibold mt-1">{{ os_info }}</p>
                </div>
                <div>
                    <p class="text-slate-500 font-bold uppercase">Browser Engine</p>
                    <p class="text-white font-semibold mt-1">Chrome Headless</p>
                </div>
                <div>
                    <p class="text-slate-500 font-bold uppercase">Environment</p>
                    <p class="text-teal-400 font-semibold mt-1">Production Deployment</p>
                </div>
                <div>
                    <p class="text-slate-500 font-bold uppercase">Trigger</p>
                    <p class="text-white font-semibold mt-1">CI/CD Pipeline</p>
                </div>
            </div>
        </section>

        <!-- Execution Timeline Table -->
        <section class="bg-[#111827]/40 border border-white/5 rounded-2xl p-6">
            <h3 class="text-white font-bold text-sm mb-4">Detailed Test Logs</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr class="border-b border-white/10 text-slate-400">
                            <th class="py-3 px-4">Test ID</th>
                            <th class="py-3 px-4">Category</th>
                            <th class="py-3 px-4">Test Name</th>
                            <th class="py-3 px-4">Status</th>
                            <th class="py-3 px-4">Duration</th>
                            <th class="py-3 px-4">Trace Details</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5">
                        {% for r in results %}
                        <tr class="hover:bg-white/2 transition">
                            <td class="py-3.5 px-4 font-mono font-bold text-teal-400">{{ r.TestID }}</td>
                            <td class="py-3.5 px-4"><span class="px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-slate-300 font-medium">{{ r.Category }}</span></td>
                            <td class="py-3.5 px-4 text-white font-medium">{{ r.TestName }}</td>
                            <td class="py-3.5 px-4">
                                {% if r.Status == 'PASS' %}
                                <span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold uppercase tracking-wider text-[9px] border border-emerald-500/20">Passed</span>
                                {% else %}
                                <span class="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-bold uppercase tracking-wider text-[9px] border border-rose-500/20">Failed</span>
                                {% endif %}
                            </td>
                            <td class="py-3.5 px-4 text-slate-400 font-mono">{{ r.Duration }}s</td>
                            <td class="py-3.5 px-4 text-rose-400 max-w-xs truncate" title="{{ r.ErrorDetails }}">{{ r.ErrorDetails }}</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
        </section>
    </main>

    <script>
        const ctx = document.getElementById('statusChart').getContext('2d');
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Passed', 'Failed'],
                datasets: [{
                    data: [{{ passed }}, {{ failed }}],
                    backgroundColor: ['#10b981', '#f43f5e'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            font: { family: 'Outfit', size: 12 }
                        }
                    }
                }
            }
        });
    </script>
</body>
</html>
"""
    # Render with jinja2
    template = Template(template_str)
    
    # Adapt keys for template matching
    adapted_results = []
    for r in results:
        adapted_results.append({
            "TestID": r["Test ID"],
            "Category": r["Category"],
            "TestName": r["Test Name"],
            "Status": r["Status"],
            "Duration": r["Duration"],
            "ErrorDetails": r["Error Details"].replace("\n", " ").replace('"', '\\"')
        })
        
    avg_dur = round(duration / total_tests, 3) if total_tests > 0 else 0.0
    os_name = sys.platform
    os_info = "Windows OS" if os_name == "win32" else "Linux Ubuntu Runner" if os_name == "linux" else "macOS Runner"
    
    html_content = template.render(
        total_tests=total_tests,
        total_assertions=total_assertions,
        pass_rate=pass_rate,
        passed=passed,
        failed=failed,
        duration=round(duration, 2),
        avg_duration=avg_dur,
        execution_date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        os_info=os_info,
        categories=categories,
        results=adapted_results
    )
    
    with open(filename, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"[SUCCESS] HTML dashboard report generated successfully: {filename}")

def generate_step_summary(results, total_assertions):
    step_summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not step_summary_path:
        return
        
    total_tests = len(results)
    passed = sum(1 for r in results if r["Status"] == "PASS")
    failed = sum(1 for r in results if r["Status"] in ["FAIL", "ERROR"])
    warnings = 0
    pass_rate = round((passed / total_tests) * 100, 2) if total_tests > 0 else 0.0
    build_number = os.environ.get("GITHUB_RUN_NUMBER", "N/A")
    commit_sha = os.environ.get("GITHUB_SHA", "N/A")
    
    with open(step_summary_path, "w", encoding="utf-8") as f:
        f.write("# TripSync E2E Results\n\n")
        f.write(f"* **Total Assertions**: {total_assertions}\n")
        f.write(f"* **Passed**: {passed}\n")
        f.write(f"* **Failed**: {failed}\n")
        f.write(f"* **Warnings**: {warnings}\n")
        f.write(f"* **Pass Percentage**: {pass_rate}%\n")
        f.write(f"* **Build Number**: {build_number}\n")
        f.write(f"* **Commit SHA**: {commit_sha}\n")
    print(f"[SUCCESS] Step summary written to: {step_summary_path}")

def main():
    print("[INFO] Starting TripSync Web E2E automated test suite run...")
    start_time = time.time()
    
    # Load and execute test cases programmatically
    suite = unittest.TestLoader().loadTestsFromTestCase(TripSyncTestSuite)
    collector = TestResultCollector()
    suite.run(collector)
    
    duration = time.time() - start_time
    total_assertions = TripSyncTestSuite.assertion_count
    
    # Generate reports
    generate_excel_report(collector.results)
    generate_html_report(collector.results, total_assertions, start_time, duration)
    generate_step_summary(collector.results, total_assertions)
    
    passed = sum(1 for r in collector.results if r["Status"] == "PASS")
    total = len(collector.results)
    
    print(f"\n[COMPLETED] Execution completed. Summary: {passed}/{total} tests passed (Assertions verified: {total_assertions}).")
    
    # Set exit status
    if passed < total:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
