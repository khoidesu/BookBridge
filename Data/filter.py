import pandas as pd

# Đọc file CSV
df = pd.read_csv("content.csv")

# Xóa các dòng có ít nhất một giá trị NULL
df = df.dropna()

# Lưu lại thành file CSV mới
df.to_csv("filter_content.csv", index=False)

print("Đã lọc dữ liệu NULL!")
print(df)