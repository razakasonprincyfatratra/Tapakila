# ============================================
# Script de test du flux de reservation Tapakila
# ============================================
# A executer section par section dans PowerShell, backend demarre (npm run dev)
#
# Identifiants du compte participant deja cree lors des tests precedents :
#   email    : test@test.com
#   password : motdepasse123

# --- 1. Connexion en tant que participant ---
$loginBody = '{"email":"test@test.com","password":"motdepasse123"}'
$login = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
$token = $login.token
Write-Host "Connecte en tant que : test@test.com"

# --- 2. Recuperer un evenement publie et son premier type de billet ---
$events = Invoke-RestMethod -Uri "http://localhost:5000/api/events"
$event = $events.events[0]
$ticketType = $event.ticketTypes[0]
Write-Host "Evenement : $($event.title) - Billet : $($ticketType.name) - Prix : $($ticketType.price) Ar"

# --- 3. Creer une reservation (2 billets) ---
$reservationBody = @{ ticketTypeId = $ticketType.id; quantity = 2 } | ConvertTo-Json
$reservation = Invoke-RestMethod -Uri "http://localhost:5000/api/reservations" -Method Post -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $reservationBody
$reservationId = $reservation.reservation.id
Write-Host "Reservation creee : $reservationId - statut : $($reservation.reservation.status)"

# --- 4. Confirmer le paiement (simulation temporaire, en attendant Efaina) ---
$confirmed = Invoke-RestMethod -Uri "http://localhost:5000/api/reservations/$reservationId/confirm" -Method Patch -Headers @{ Authorization = "Bearer $token" }
Write-Host "Reservation confirmee - QR : $($confirmed.reservation.qrCode)"
Write-Host "Code de secours : $($confirmed.reservation.backupCode)"

# --- 5. Voir mes reservations ---
Invoke-RestMethod -Uri "http://localhost:5000/api/reservations/mine" -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json -Depth 5

# --- 6. Check-in avec le QR ---
# Necessite d'etre connecte en tant qu'ORGANISATEUR de l'evenement, ou ADMIN.
# Remplace l'email/mot de passe ci-dessous par un compte organisateur/admin reel.
#
# $organizerLoginBody = '{"email":"organisateur@test.com","password":"motdepasse123"}'
# $organizerLogin = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -ContentType "application/json" -Body $organizerLoginBody
# $organizerToken = $organizerLogin.token
# $checkInBody = @{ code = $confirmed.reservation.qrCode } | ConvertTo-Json
# Invoke-RestMethod -Uri "http://localhost:5000/api/reservations/check-in" -Method Post -Headers @{ Authorization = "Bearer $organizerToken" } -ContentType "application/json" -Body $checkInBody

# --- 7. Rejouer le meme check-in (doit renvoyer alreadyUsed: true, sans erreur) ---
# Invoke-RestMethod -Uri "http://localhost:5000/api/reservations/check-in" -Method Post -Headers @{ Authorization = "Bearer $organizerToken" } -ContentType "application/json" -Body $checkInBody