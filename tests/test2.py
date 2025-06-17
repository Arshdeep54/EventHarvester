import requests

url = "https://cryptonomads.org/api/airtable/events"
payload = {
    "queryType": "findSideEventBySlug",
    "seriesSlug": "BerBW2025",
    "slug": "MasTJf"
}
headers = {
    "Content-Type": "application/json",
    "Accept": "*/*"
}

response = requests.post(url, json=payload, headers=headers)
print("Status code:", response.status_code)
print("Response:", response.json())