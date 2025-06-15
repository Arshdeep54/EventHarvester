import requests

url = "https://cryptonomads.org/api/luma/get_event"
headers = {
    "accept": "*/*",
    "accept-language": "en-US,en;q=0.9",
    "content-type": "text/plain;charset=UTF-8",
}
data = '{"lumaEventId":"n6e7l7hn"}'
response = requests.options(url, headers=headers)
print("Options:", response)
response = requests.post(url, headers=headers, data=data)
print("Status code:", response.status_code)
print("Response text:", response.text)
