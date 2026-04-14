import requests
url = "https://hasura-auth-api-960327267159.us-east4.run.app/api/signup"
payload = {
"email": "koharrisonko@gmail.com",
"password": "Harrison123!",
"key": "cc399aab-2554-44cb-9a3c-6a46ad436c9f"
}
headers = {"Content-Type": "application/json"}
response = requests.request("POST", url, json=payload, headers=headers)
print(response.text)