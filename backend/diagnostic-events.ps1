# Diagnostic : combien d'evenements publies existent, et quel est le statut
# des evenements crees par un compte organisateur.

# --- Voir les evenements publics (ce que /api/events retourne) ---
$publicEvents = Invoke-RestMethod -Uri "http://localhost:5000/api/events"
Write-Host "Nombre d'evenements publies visibles publiquement : $($publicEvents.events.Count)"
$publicEvents | ConvertTo-Json -Depth 5

# --- Voir TOUS les evenements d'un compte organisateur (y compris les brouillons) ---
# Remplace par les identifiants du compte que tu as utilise pour creer un evenement
# via le frontend (celui passe en ORGANIZER).
$organizerLoginBody = '{"email":"REMPLACE_PAR_TON_EMAIL_ORGANISATEUR","password":"REMPLACE_PAR_TON_MOT_DE_PASSE"}'
$organizerLogin = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -ContentType "application/json" -Body $organizerLoginBody
$organizerToken = $organizerLogin.token

$myEvents = Invoke-RestMethod -Uri "http://localhost:5000/api/events/mine" -Headers @{ Authorization = "Bearer $organizerToken" }
Write-Host "Nombre total d'evenements de ce compte (tous statuts) : $($myEvents.events.Count)"
$myEvents.events | Select-Object title, status, id | Format-Table