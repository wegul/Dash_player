from urllib.request import urlopen
from urllib.request import Request
from urllib import parse
from bs4 import BeautifulSoup
import os
import re

# 本爬虫功能
#   爬取url上指定文件夹内所有文件


# 关于改进方案
#   可采取栈的方式,使用深度优先遍历，如果遇到文件夹,放入栈中
#   继续递归,直到所有a标签的数量与文件数量相等，此时返回，弹出栈顶元素，继续向下执行
#   弹出所有栈内元素，则执行结束，这样可以对整个站点进行爬取，下载所有文件

# 代码实现

# 基础URL
baseUrl = 'https://dash.akamaized.net/akamai/bbb_30fps/'
# 列表url
otherUrl = ''
# otherUrl = "ListDir.jsp?Dir=srXdHI4teMY5iurnj5rqvUqYBNxX4N5oDkBRTbKuMgLzU4y42YPfnvTOUiLcs6zt"

# 存放文件夹名字
folder = "./big buck bunny"
# 完整url
url = baseUrl + otherUrl

req = Request(url)
req.add_header("User-Agent",
               "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.76 Mobile Safari/537.36")
res = urlopen(req)
data = res.read().decode("utf-8")
# 使用beautifulsoup
soup = BeautifulSoup(data, "lxml")

# 包含tr的对象列表
# infoList = soup.find_all('a')

infoList = soup.find_all('a')
del infoList[0]

# 判断是否文件夹存在
if (os.path.exists(folder) == False):
    # 如果不存在新建文件夹
    os.mkdir(folder)

os.chdir(folder)

for info in infoList:
    # print(info.find_all('td')[1].text.replace('[','').replace(']','') == '文件')
    # 正则表达式对后缀名进行判断，如果有后缀名，则数组长度不为1，说明链接是文件而不是文件夹
    if (len(re.compile(r'\.[a-zA-Z0-9]+$').findall(info.text.strip()))):
        # 提取文件名
        filename = info.text.strip()
        if filename.endswith('zip'):
            continue
        # 拼接url
        response = urlopen(baseUrl + info['href'])
        file = response.read()
        # 文件存储
        with open(filename, 'wb') as f:
            print("save -> %s " % filename)
            f.write(file)
