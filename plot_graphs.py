#!/usr/bin/env python3
"""
Botnet Attack Analysis — Academic Report Graph Generator (Optimized)
Generates 5 publication-ready graphs with memory optimization and proper statistical visualization.
"""

import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import os
from scipy import stats as scipy_stats

# ─── 1. Configuration & Styling ────────────────────────────────────────
CSV_FILE = "attack_data.csv"
OUTPUT_DIR = "report_graphs"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ธีมสว่าง (Light Theme) เหมาะสำหรับแทรกลงในรายงานหรือตีพิมพ์
plt.rcParams.update({
    "figure.facecolor": "white",
    "axes.facecolor": "white",
    "axes.edgecolor": "#333333",
    "axes.labelcolor": "#333333",
    "text.color": "#333333",
    "xtick.color": "#333333",
    "ytick.color": "#333333",
    "grid.color": "#dddddd",
    "grid.alpha": 0.7,
    "font.size": 11,
    "font.family": "sans-serif",
})

SCENARIOS = ["Basic-Login", "Rate-Limit-Login", "Rate-Limit-RandomIP", "Captcha-Login", "MFA-Login"]
LABELS = ["Basic Login", "Rate-Limit\n(IP Pool)", "Rate-Limit\n(Random IP)", "CAPTCHA", "MFA"]
COLORS = {
    "Basic-Login": "#e74c3c",          # Red
    "Rate-Limit-Login": "#3498db",     # Blue
    "Rate-Limit-RandomIP": "#9b59b6",  # Purple
    "Captcha-Login": "#f1c40f",        # Yellow
    "MFA-Login": "#2ecc71",            # Green
}

# ─── 2. Memory-Optimized Data Loading ──────────────────────────────────
print("Loading and optimizing data...")
# กำหนด Data Types ตั้งแต่ตอนโหลดเพื่อประหยัด Memory
dtypes = {
    'Scenario': 'category',
    'Status': 'category',
    'Duration_ms': 'float32',
    'CPU_ms': 'float32',
    'Memory_MB': 'float32',
    'Run': 'int8'
}
df = pd.read_csv(CSV_FILE, dtype=dtypes, usecols=['Timestamp', 'Scenario', 'Status', 'Duration_ms', 'CPU_ms', 'Memory_MB', 'Run'])
df["Timestamp"] = pd.to_datetime(df["Timestamp"])

num_runs = df["Run"].nunique() if "Run" in df.columns else 1

# กรอง Warm-up 5 วินาทีแรก (คำนวณแบบ Vectorized เร็วกว่าลูป)
df['Elapsed_s'] = df.groupby(['Scenario', 'Run'])['Timestamp'].transform(lambda x: (x - x.min()).dt.total_seconds())
df = df[df['Elapsed_s'] > 5].copy() # ใช้ .copy() ครั้งเดียวหลังกรองเสร็จ

print(f"Loaded {len(df)} rows across {num_runs} runs.")

# ─── Pre-calculate Aggregates ─────────────────────────────────────────
stats_df = df.groupby(['Scenario', 'Run'], observed=True).agg(
    total_requests=('Timestamp', 'count'),
    avg_cpu=('CPU_ms', 'mean'),
    avg_duration=('Duration_ms', 'mean'),
    blocked_429=('Status', lambda x: (x == 429).sum())
).reset_index()

mean_stats = stats_df.groupby('Scenario', observed=True).mean(numeric_only=True)
std_stats = stats_df.groupby('Scenario', observed=True).std(numeric_only=True).fillna(0)

# Baseline สำหรับคำนวณ Throughput Reduction
baseline_throughput = mean_stats.loc["Basic-Login", "total_requests"]

# ─── Graph 1: 100% Stacked Bar (Status Code Distribution) ──────────────
print("Generating Graph 1...")
fig, ax = plt.subplots(figsize=(10, 6))

# นับจำนวน Status Code ของแต่ละ Scenario
status_counts = df.groupby(['Scenario', 'Status'], observed=True).size().unstack(fill_value=0)
# แปลงเป็น %
status_pct = status_counts.div(status_counts.sum(axis=1), axis=0) * 100
# เรียงลำดับตาม SCENARIOS
status_pct = status_pct.reindex(SCENARIOS)

# สีสำหรับ Status Codes
status_colors = {200: '#2ecc71', 401: '#e74c3c', 403: '#f39c12', 429: '#3498db'}
colors_for_plot = [status_colors.get(int(col), '#95a5a6') for col in status_pct.columns]

status_pct.plot(kind='barh', stacked=True, color=colors_for_plot, ax=ax, width=0.7)

ax.set_yticklabels(LABELS)
ax.set_xlabel("Percentage of Requests (%)")
ax.set_ylabel("")
ax.set_title("Status Code Distribution per Authentication Method", fontweight="bold")
ax.legend(title="HTTP Status", bbox_to_anchor=(1.05, 1), loc='upper left')
ax.grid(axis='x', linestyle='--')
plt.tight_layout()
plt.savefig(f"{OUTPUT_DIR}/01_status_distribution.png", dpi=300)
plt.close()

# ─── Graph 2: Throughput Reduction & CPU Cost ──────────────────────────
print("Generating Graph 2...")
fig, axes = plt.subplots(1, 2, figsize=(14, 6))
fig.suptitle(f"System Performance Trade-offs (n={num_runs} runs)", fontweight="bold", fontsize=14)

t_means = mean_stats.loc[SCENARIOS, "total_requests"].values
t_stds = std_stats.loc[SCENARIOS, "total_requests"].values
c_means = mean_stats.loc[SCENARIOS, "avg_cpu"].values
c_stds = std_stats.loc[SCENARIOS, "avg_cpu"].values
colors_list = [COLORS[s] for s in SCENARIOS]

# Throughput Bar
bars1 = axes[0].bar(LABELS, t_means, yerr=t_stds, capsize=5, color=colors_list, edgecolor="black", alpha=0.8)
axes[0].set_ylabel("Total Requests in 60s")
axes[0].set_title("Botnet Throughput (Lower = Better)", fontweight="bold")
axes[0].grid(axis="y", linestyle="--")
for i, bar in enumerate(bars1):
    red = (1 - t_means[i]/baseline_throughput) * 100
    axes[0].text(bar.get_x() + bar.get_width()/2, bar.get_height() / 2,
                 f"-{red:.1f}%" if red > 0 else "Baseline", ha="center", va="center", 
                 fontweight="bold", color="white" if red > 0 else "black")

# CPU Bar
bars2 = axes[1].bar(LABELS, c_means, yerr=c_stds, capsize=5, color=colors_list, edgecolor="black", alpha=0.8)
axes[1].set_ylabel("Avg CPU Time per Request (ms)")
axes[1].set_title("Server CPU Cost (Trade-off)", fontweight="bold")
axes[1].grid(axis="y", linestyle="--")

plt.tight_layout()
plt.savefig(f"{OUTPUT_DIR}/02_throughput_vs_cpu.png", dpi=300)
plt.close()

# ─── Graph 3: The Rate Limit Gap ───────────────────────────────────────
print("Generating Graph 3...")
fig, ax = plt.subplots(figsize=(8, 6))

rl_scenarios = ["Rate-Limit-Login", "Rate-Limit-RandomIP"]
rl_labels = ["Cheap Botnet\n(IP Pool: 250 IPs)", "Advanced Botnet\n(Random IP)"]
rl_t_means = mean_stats.loc[rl_scenarios, "total_requests"].values
rl_t_stds = std_stats.loc[rl_scenarios, "total_requests"].values

# --- [FIXED] คำนวณ Block Rate ---
# ดึงจาก df หลักโดยตรง และบังคับแปลง Status เป็น Numeric ก่อนเปรียบเทียบ
rl_df = df[df['Scenario'].isin(rl_scenarios)]
rl_block_rates = rl_df.groupby('Scenario', observed=True).apply(
    lambda x: (pd.to_numeric(x['Status'], errors='coerce') == 429).sum() / len(x) * 100
)

bars = ax.bar(rl_labels, rl_t_means, yerr=rl_t_stds, capsize=5, width=0.5, 
              color=[COLORS[rl_scenarios[0]], COLORS[rl_scenarios[1]]], edgecolor="black", alpha=0.8)

ax.set_ylabel("Total Requests in 60s")
ax.set_title("The Rate Limit Gap: IP Pool vs Random IP Spoofing", fontweight="bold")
ax.grid(axis="y", linestyle="--")

for i, bar in enumerate(bars):
    # ดึงอัตรา Block Rate มาแสดง (ใช้ .get เผื่อกรณีหา key ไม่เจอให้คืนค่า 0)
    rate = rl_block_rates.get(rl_scenarios[i], 0)
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + rl_t_stds[i] + 50,
            f"Blocked: {rate:.1f}%", ha="center", fontweight="bold", color="#d35400")

plt.tight_layout()
plt.savefig(f"{OUTPUT_DIR}/03_rate_limit_gap.png", dpi=300)
plt.close()

# ─── Graph 4: True CPU Cost (Box Plot + Stats) ─────────────────────────
print("Generating Graph 4 (from CPU Profiling Data)...")
fig, ax = plt.subplots(figsize=(10, 6))

CPU_CSV_FILE = "cpu_profile_data.csv"

# ตรวจสอบว่ามีไฟล์ของ Phase 2 หรือไม่
if os.path.exists(CPU_CSV_FILE):
    # อ่านไฟล์แยกสำหรับ CPU Profiling โดยเฉพาะ
    cpu_df = pd.read_csv(CPU_CSV_FILE)
    cpu_df["Timestamp"] = pd.to_datetime(cpu_df["Timestamp"])
    
    # กรอง 5 วินาทีแรกทิ้ง (Warm-up phase)
    cpu_df['Elapsed_s'] = cpu_df.groupby('Scenario')['Timestamp'].transform(lambda x: (x - x.min()).dt.total_seconds())
    cpu_df = cpu_df[cpu_df['Elapsed_s'] > 5].copy()
    
    cpu_scenarios = ["Captcha-Login", "MFA-Login"]
    cpu_data = [cpu_df[cpu_df['Scenario'] == s]['CPU_ms'].dropna() for s in cpu_scenarios]

    bp = ax.boxplot(cpu_data, tick_labels=["CAPTCHA (Network I/O)", "MFA (HMAC-SHA1)"], patch_artist=True,
                    medianprops=dict(color="black", linewidth=2), showfliers=False)

    for patch, color in zip(bp['boxes'], [COLORS["Captcha-Login"], COLORS["MFA-Login"]]):
        patch.set_facecolor(color)
        patch.set_alpha(0.7)

    ax.set_ylabel("Pure CPU Time per Request (ms)")
    ax.set_title("True CPU Cost: MFA vs CAPTCHA (Tested in Isolation Phase)", fontweight="bold")
    ax.grid(axis="y", linestyle="--")

    # Statistical Test (Mann-Whitney U)
    if len(cpu_data[0]) > 0 and len(cpu_data[1]) > 0:
        # สมมติฐานเราคือ MFA (index 1) กิน CPU มากกว่า CAPTCHA (index 0)
        u_stat, p_value = scipy_stats.mannwhitneyu(cpu_data[1], cpu_data[0], alternative="greater")
        text = (f"Statistical Significance (Mann-Whitney U):\n"
                f"MFA median: {cpu_data[1].median():.2f} ms\n"
                f"CAPTCHA median: {cpu_data[0].median():.2f} ms\n"
                f"p-value: {p_value:.2e} ({'Significant' if p_value < 0.05 else 'Not Sig.'})")
        
        ax.text(0.05, 0.95, text, transform=ax.transAxes, fontsize=10,
                verticalalignment='top', bbox=dict(boxstyle='round', facecolor='white', alpha=0.9))
else:
    ax.text(0.5, 0.5, "Missing cpu_profile_data.csv\nPlease run Phase 2 script.", ha='center', va='center')

plt.tight_layout()
plt.savefig(f"{OUTPUT_DIR}/04_true_cpu_cost.png", dpi=300)
plt.close()

# ─── Graph 5: CAPTCHA Latency Hexbin ───────────────────────────────────
print("Generating Graph 5...")
fig, ax = plt.subplots(figsize=(10, 6))

captcha_df = df[df['Scenario'] == "Captcha-Login"]

if not captcha_df.empty:
    # ใช้ Hexbin แทน Scatter เพื่อแก้ปัญหา Overplotting และประหยัด Memory/File Size
    hb = ax.hexbin(captcha_df['Elapsed_s'], captcha_df['Duration_ms'], 
                   gridsize=50, cmap='YlOrRd', mincnt=1)
    
    cb = fig.colorbar(hb, ax=ax, label='Number of Requests')
    
    # วาดเส้น Expected Range ของ Mock Server (80-150ms)
    ax.axhline(80, color='green', linestyle='--', linewidth=2, label='Mock Server Min (80ms)')
    ax.axhline(150, color='red', linestyle='--', linewidth=2, label='Mock Server Max (150ms)')
    
    ax.set_xlabel("Time Within Test (seconds)")
    ax.set_ylabel("Response Time (ms)")
    ax.set_title("CAPTCHA Latency Density (Variable Delay Verification)", fontweight="bold")
    ax.legend(loc="upper right")
    
    # ลิมิตแกน Y เพื่อไม่ให้ Outlier ดึงกราฟพัง
    ax.set_ylim(0, captcha_df['Duration_ms'].quantile(0.99) * 1.2)

plt.tight_layout()
plt.savefig(f"{OUTPUT_DIR}/05_captcha_latency_density.png", dpi=300)
plt.close()

print(f"\nDone! 5 Publication-ready graphs saved to ./{OUTPUT_DIR}/")