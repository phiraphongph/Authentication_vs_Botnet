#!/usr/bin/env python3
"""
📊 Botnet Attack Analysis — Insight Graph Generator
สร้างกราฟเปรียบเทียบ Basic Login vs Rate-Limited Login
"""

import pandas as pd
import matplotlib.pyplot as plt
import matplotlib
import numpy as np
import os

matplotlib.use("Agg")  # ใช้ backend ที่ไม่ต้องมี GUI

# ─── 1. Load Data ──────────────────────────────────────────────────
CSV_FILE = "attack_data.csv"
OUTPUT_DIR = "graphs"
os.makedirs(OUTPUT_DIR, exist_ok=True)

df = pd.read_csv(CSV_FILE)
df["Timestamp"] = pd.to_datetime(df["Timestamp"])

# แยกข้อมูลตาม Scenario
basic = df[df["Scenario"] == "Basic-Login"].copy()
ratelimit = df[df["Scenario"] == "Rate-Limit-Login"].copy()

# คำนวณเวลาสัมพัทธ์ (วินาที) จากจุดเริ่มต้น
t0 = df["Timestamp"].min()
df["Elapsed_s"] = (df["Timestamp"] - t0).dt.total_seconds()

# [NEW] Filter out warm-up period (first 5 seconds) to remove cold-start spikes
# This makes the trend graph scale readable
df = df[df["Elapsed_s"] > 5].copy()

# Recalculate basic/ratelimit datasets after filtering
basic = df[df["Scenario"] == "Basic-Login"].copy()
ratelimit = df[df["Scenario"] == "Rate-Limit-Login"].copy()

print(f"📄 Loaded {len(df)} rows from {CSV_FILE} (after filtering first 5s)")
print(f"   Basic-Login:      {len(basic)} requests")
print(f"   Rate-Limit-Login: {len(ratelimit)} requests")
print(f"   Duration:         {(df['Timestamp'].max() - t0).total_seconds():.0f} seconds")
print()

# ─── สไตล์กราฟ ──────────────────────────────────────────────────────
plt.rcParams.update({
    "figure.facecolor": "#1a1a2e",
    "axes.facecolor": "#16213e",
    "axes.edgecolor": "#e94560",
    "axes.labelcolor": "white",
    "text.color": "white",
    "xtick.color": "white",
    "ytick.color": "white",
    "grid.color": "#0f3460",
    "grid.alpha": 0.5,
    "font.size": 11,
})

COLOR_BASIC = "#ff6b6b"       # แดง = ไม่มี Rate Limit (อันตราย)
COLOR_RATELIMIT = "#4ecdc4"   # เขียว = มี Rate Limit (ปลอดภัย)
COLOR_BLOCKED = "#ffd93d"     # เหลือง = ถูกบล็อก 429

# ─── 2. Graph 1: Status Code Distribution (Pie Chart) ────────────
fig, axes = plt.subplots(1, 2, figsize=(14, 6))
fig.suptitle("Status Code Distribution: Basic vs Rate-Limited", fontsize=16, fontweight="bold")

for ax, data, title, colors in [
    (axes[0], basic, "Basic Login (No Rate Limit)", [COLOR_BASIC, "#ff9ff3"]),
    (axes[1], ratelimit, "Rate-Limited Login (With Rate Limit)", [COLOR_RATELIMIT, COLOR_BLOCKED, "#ff9ff3"]),
]:
    counts = data["Status"].value_counts()
    labels = [f"Status {s}\n({c} reqs)" for s, c in counts.items()]
    wedges, texts, autotexts = ax.pie(
        counts.values, labels=labels, autopct="%1.1f%%",
        colors=colors[:len(counts)], textprops={"color": "white", "fontsize": 10},
        startangle=90, pctdistance=0.75,
    )
    for t in autotexts:
        t.set_fontweight("bold")
    ax.set_title(title, fontsize=12, pad=15)

plt.tight_layout()
plt.savefig(f"{OUTPUT_DIR}/01_status_distribution.png", dpi=150, bbox_inches="tight")
plt.close()
print("✅ Graph 1: Status Code Distribution → saved")

# ─── 3. Graph 2: Response Time Over Time ──────────────────────────
fig, ax = plt.subplots(figsize=(14, 6))
ax.scatter(basic["Elapsed_s"], basic["Duration_ms"], alpha=0.3, s=10, c=COLOR_BASIC, label="Basic Login")
ax.scatter(ratelimit["Elapsed_s"], ratelimit["Duration_ms"], alpha=0.3, s=10, c=COLOR_RATELIMIT, label="Rate-Limited Login")
ax.set_xlabel("Time (seconds)")
ax.set_ylabel("Response Time (ms)")
ax.set_title("Response Time Over Time: Basic vs Rate-Limited", fontsize=14, fontweight="bold")
ax.legend(facecolor="#16213e", edgecolor="#e94560")
ax.grid(True)
# [NEW] Zoom in Y-axis
max_y = pd.concat([basic["Duration_ms"], ratelimit["Duration_ms"]]).quantile(0.95) * 1.5
ax.set_ylim(0, max(50, max_y))
plt.tight_layout()
plt.savefig(f"{OUTPUT_DIR}/02_response_time.png", dpi=150, bbox_inches="tight")
plt.close()
print("✅ Graph 2: Response Time Over Time → saved")

# ─── 4. Graph 3: CPU Usage Comparison (Box Plot) ─────────────────
fig, axes = plt.subplots(1, 2, figsize=(14, 6))
fig.suptitle("Server Resource Usage: Basic vs Rate-Limited", fontsize=16, fontweight="bold")

# CPU Box Plot
bp1 = axes[0].boxplot(
    [basic["CPU_ms"].dropna(), ratelimit["CPU_ms"].dropna()],
    labels=["Basic Login", "Rate-Limited"],
    patch_artist=True,
    boxprops=dict(facecolor=COLOR_BASIC, color="white"),
    medianprops=dict(color="white", linewidth=2),
    whiskerprops=dict(color="white"),
    capprops=dict(color="white"),
    flierprops=dict(markeredgecolor="white", markersize=3),
)
bp1["boxes"][1].set_facecolor(COLOR_RATELIMIT)
axes[0].set_ylabel("CPU Time (ms)")
axes[0].set_title("CPU Usage per Request", fontsize=12)
axes[0].grid(True, axis="y")

# Memory Box Plot
bp2 = axes[1].boxplot(
    [basic["Memory_MB"].dropna(), ratelimit["Memory_MB"].dropna()],
    labels=["Basic Login", "Rate-Limited"],
    patch_artist=True,
    boxprops=dict(facecolor=COLOR_BASIC, color="white"),
    medianprops=dict(color="white", linewidth=2),
    whiskerprops=dict(color="white"),
    capprops=dict(color="white"),
    flierprops=dict(markeredgecolor="white", markersize=3),
)
bp2["boxes"][1].set_facecolor(COLOR_RATELIMIT)
axes[1].set_ylabel("Memory (MB)")
axes[1].set_title("Memory Usage per Request", fontsize=12)
axes[1].grid(True, axis="y")

plt.tight_layout()
plt.savefig(f"{OUTPUT_DIR}/03_resource_usage.png", dpi=150, bbox_inches="tight")
plt.close()
print("✅ Graph 3: Resource Usage Comparison → saved")

# ─── 5. Graph 4: Memory Trend Over Time ──────────────────────────
fig, ax = plt.subplots(figsize=(14, 6))
ax.plot(basic["Elapsed_s"], basic["Memory_MB"], alpha=0.5, color=COLOR_BASIC, linewidth=0.8, label="Basic Login")
ax.plot(ratelimit["Elapsed_s"], ratelimit["Memory_MB"], alpha=0.5, color=COLOR_RATELIMIT, linewidth=0.8, label="Rate-Limited Login")
ax.set_xlabel("Time (seconds)")
ax.set_ylabel("Memory Usage (MB)")
ax.set_title("Memory Usage Trend Under Botnet Attack", fontsize=14, fontweight="bold")
ax.legend(facecolor="#16213e", edgecolor="#e94560")
ax.grid(True)
plt.tight_layout()
plt.savefig(f"{OUTPUT_DIR}/04_memory_trend.png", dpi=150, bbox_inches="tight")
plt.close()
print("✅ Graph 4: Memory Trend → saved")

# ─── 6. Graph 5: Request Rate & Block Rate Over Time ─────────────
fig, axes = plt.subplots(2, 1, figsize=(14, 10), sharex=True)
fig.suptitle("Rate Limiting Effectiveness Over Time", fontsize=16, fontweight="bold")

# Bin by 10-second intervals
bin_size = 10
max_time = df["Elapsed_s"] = (df["Timestamp"] - t0).dt.total_seconds()
bins = np.arange(0, max_time.max() + bin_size, bin_size)

basic_elapsed = (basic["Timestamp"] - t0).dt.total_seconds()
rl_elapsed = (ratelimit["Timestamp"] - t0).dt.total_seconds()

basic_counts, _ = np.histogram(basic_elapsed, bins=bins)
rl_counts, _ = np.histogram(rl_elapsed, bins=bins)
blocked = ratelimit[ratelimit["Status"] == 429]
blocked_elapsed = (blocked["Timestamp"] - t0).dt.total_seconds()
blocked_counts, _ = np.histogram(blocked_elapsed, bins=bins)

bin_centers = (bins[:-1] + bins[1:]) / 2

# Subplot 1: Request volume
axes[0].bar(bin_centers, basic_counts, width=bin_size * 0.4, color=COLOR_BASIC, alpha=0.8, label="Basic Login", align="center")
axes[0].bar(bin_centers + bin_size * 0.4, rl_counts, width=bin_size * 0.4, color=COLOR_RATELIMIT, alpha=0.8, label="Rate-Limited Login", align="center")
axes[0].set_ylabel("Requests per 10s")
axes[0].set_title("Request Volume", fontsize=12)
axes[0].legend(facecolor="#16213e", edgecolor="#e94560")
axes[0].grid(True, axis="y")

# Subplot 2: Block rate
block_rate = np.where(rl_counts > 0, (blocked_counts / rl_counts) * 100, 0)
axes[1].fill_between(bin_centers, block_rate, alpha=0.6, color=COLOR_BLOCKED, label="Block Rate (%)")
axes[1].plot(bin_centers, block_rate, color=COLOR_BLOCKED, linewidth=2)
axes[1].set_xlabel("Time (seconds)")
axes[1].set_ylabel("Blocked (%)")
axes[1].set_title("Rate Limit Block Rate (429 responses)", fontsize=12)
axes[1].set_ylim(0, 105)
axes[1].legend(facecolor="#16213e", edgecolor="#e94560")
axes[1].grid(True)

plt.tight_layout()
plt.savefig(f"{OUTPUT_DIR}/05_rate_limit_effectiveness.png", dpi=150, bbox_inches="tight")
plt.close()
print("✅ Graph 5: Rate Limit Effectiveness → saved")

# ─── 7. Graph 6: Summary Dashboard ──────────────────────────────
fig, axes = plt.subplots(2, 2, figsize=(14, 10))
fig.suptitle("Attack Simulation Summary Dashboard", fontsize=18, fontweight="bold", y=1.02)

# Summary Stats
basic_blocked = len(basic[basic["Status"] == 429])
rl_blocked = len(ratelimit[ratelimit["Status"] == 429])

stats = {
    "Metric": [
        "Total Requests",
        "Blocked (429)",
        "Block Rate",
        "Avg Response (ms)",
        "Avg CPU (ms)",
        "Avg Memory (MB)",
    ],
    "Basic Login": [
        f"{len(basic)}",
        f"{basic_blocked}",
        f"{basic_blocked/max(len(basic),1)*100:.1f}%",
        f"{basic['Duration_ms'].mean():.1f}",
        f"{basic['CPU_ms'].mean():.1f}",
        f"{basic['Memory_MB'].mean():.1f}",
    ],
    "Rate-Limited": [
        f"{len(ratelimit)}",
        f"{rl_blocked}",
        f"{rl_blocked/max(len(ratelimit),1)*100:.1f}%",
        f"{ratelimit['Duration_ms'].mean():.1f}",
        f"{ratelimit['CPU_ms'].mean():.1f}",
        f"{ratelimit['Memory_MB'].mean():.1f}",
    ],
}

# Table
axes[0, 0].axis("off")
table = axes[0, 0].table(
    cellText=list(zip(stats["Metric"], stats["Basic Login"], stats["Rate-Limited"])),
    colLabels=["Metric", "Basic Login", "Rate-Limited"],
    loc="center",
    cellLoc="center",
)
table.auto_set_font_size(False)
table.set_fontsize(10)
table.scale(1, 1.8)
for key, cell in table.get_celld().items():
    cell.set_edgecolor("#e94560")
    cell.set_facecolor("#16213e")
    cell.set_text_props(color="white")
    if key[0] == 0:
        cell.set_facecolor("#e94560")
        cell.set_text_props(color="white", fontweight="bold")
axes[0, 0].set_title("Key Metrics", fontsize=13, fontweight="bold", pad=20)

# Avg CPU comparison bar
metrics = ["Duration_ms", "CPU_ms"]
basic_vals = [basic[m].mean() for m in metrics]
rl_vals = [ratelimit[m].mean() for m in metrics]
x = np.arange(len(metrics))
w = 0.35
axes[0, 1].bar(x - w/2, basic_vals, w, label="Basic", color=COLOR_BASIC)
axes[0, 1].bar(x + w/2, rl_vals, w, label="Rate-Limited", color=COLOR_RATELIMIT)
axes[0, 1].set_xticks(x)
axes[0, 1].set_xticklabels(["Response Time", "CPU Time"])
axes[0, 1].set_ylabel("Milliseconds (ms)")
axes[0, 1].set_title("Avg Performance", fontsize=13, fontweight="bold")
axes[0, 1].legend(facecolor="#16213e", edgecolor="#e94560")
axes[0, 1].grid(True, axis="y")

# CPU over time (moving average)
window = 20
if len(basic) >= window:
    axes[1, 0].plot(
        basic["Elapsed_s"].rolling(window).mean(),
        basic["CPU_ms"].rolling(window).mean(),
        color=COLOR_BASIC, linewidth=2, label="Basic Login", alpha=0.8,
    )
if len(ratelimit) >= window:
    axes[1, 0].plot(
        ratelimit["Elapsed_s"].rolling(window).mean(),
        ratelimit["CPU_ms"].rolling(window).mean(),
        color=COLOR_RATELIMIT, linewidth=2, label="Rate-Limited", alpha=0.8,
    )
axes[1, 0].set_xlabel("Time (seconds)")
axes[1, 0].set_ylabel("CPU (ms)")
axes[1, 0].set_title("CPU Trend (Moving Avg)", fontsize=13, fontweight="bold")
axes[1, 0].legend(facecolor="#16213e", edgecolor="#e94560")
axes[1, 0].grid(True)
# [NEW] Zoom in Y-axis for CPU Trend
cpu_max_y = pd.concat([basic["CPU_ms"], ratelimit["CPU_ms"]]).quantile(0.95) * 2
axes[1, 0].set_ylim(0, max(50, cpu_max_y))

# Response time histogram
axes[1, 1].hist(basic["Duration_ms"], bins=50, alpha=0.6, color=COLOR_BASIC, label="Basic Login", density=True)
axes[1, 1].hist(ratelimit["Duration_ms"], bins=50, alpha=0.6, color=COLOR_RATELIMIT, label="Rate-Limited", density=True)
axes[1, 1].set_xlabel("Response Time (ms)")
axes[1, 1].set_ylabel("Density")
axes[1, 1].set_title("Response Time Distribution", fontsize=13, fontweight="bold")
axes[1, 1].legend(facecolor="#16213e", edgecolor="#e94560")
axes[1, 1].grid(True, axis="y")

plt.tight_layout()
plt.savefig(f"{OUTPUT_DIR}/06_summary_dashboard.png", dpi=150, bbox_inches="tight")
plt.close()
print("✅ Graph 6: Summary Dashboard → saved")

print(f"\n🎉 All graphs saved to ./{OUTPUT_DIR}/ directory!")
print("   Open them with: open graphs/")
