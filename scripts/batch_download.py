from urllib.request import urlopen
from urllib.request import Request
from urllib import parse
from bs4 import BeautifulSoup
import os
import re

baseUrl = "https://dash.akamaized.net/akamai/bbb_30fps/"


def download(name, folder, URL=baseUrl):
    if (os.path.exists(folder) == False):
        # 如果不存在新建文件夹
        os.mkdir(folder)
    # 提取文件名
    filename = folder + name
    if filename.endswith('zip') or filename.endswith('mp4') or filename.find('30fps') < 0:
        return
    if name in sset:
        # print('skip ' + filename)
        return
    # 拼接url
    print("in process -> %s " % (URL + name))
    URL = (URL + name).strip(' ')
    response = urlopen(URL)

    file = response.read()
    # 文件存储
    with open(filename, 'wb') as f:
        print("save -> %s " % filename)
        f.write(file)


def chInfo(url):
    req = Request(url)
    req.add_header("User-Agent",
                   "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.76 Mobile Safari/537.36")
    res = urlopen(req)
    data = res.read().decode("utf-8")
    # 使用beautifulsoup
    soup = BeautifulSoup(data, "lxml")
    infoList = soup.find_all('a')
    del infoList[0]
    return infoList  # a list of elements in directory(url)


def R(url, infoList):
    if infoList is None:
        infoList = chInfo(url)

    folder = './'
    if len(url.split('/')) > 4:
        for item in url.split('/')[4:]:
            if len(item) > 1:
                folder += item + '/'
    for info in infoList:
        name=info['href'].strip(' ')
        if not name.endswith('/'):
            # try:
                download(name, folder, url)
            # except BaseException:
            #     print('error in ' + url)
        else:
            tempurl = baseUrl + info['href']
            R(tempurl, chInfo(tempurl))


def scandir(startdir):
    global sset
    os.chdir(startdir)
    for obj in os.listdir(os.curdir):
        if os.path.isdir(obj):
            scandir(obj)
            os.chdir(os.pardir)
        else:
            sset.add(obj)



if __name__ == '__main__':
    sset=set()
    scandir('./bbb_30fps')
    os.chdir('C:\Files\DASH_HSR\Dash_player\scripts')
    R(baseUrl,None)
