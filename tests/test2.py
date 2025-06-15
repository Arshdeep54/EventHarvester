import requests

url = "https://cryptonomads.org/api/airtable/events"
payload = {
    "queryType": "findSideEventBySlug",
    "slug": "interopacc-TJf",
    "seriesSlug": "PermissionlessSideEvents2025"
}
headers = {
    "Content-Type": "application/json",
    "Accept": "*/*"
}

response = requests.post(url, json=payload, headers=headers)
print("Status code:", response.status_code)
print("Response:", response.json())