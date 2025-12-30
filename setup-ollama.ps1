Write-Host "📦 Descargando modelo base llama3.2:1b..."
docker exec dualeat_ollama ollama pull llama3.2:1b

Write-Host "🔍 Verificando si el modelo llama3.2:1b ya existe..."
$exists = docker exec dualeat_ollama ollama list | Select-String "llama3.2:1b"

if ($exists) {
  Write-Host "✅ El modelo llama3.2:1b ya está instalado."
} else {
  Write-Host "👨‍🍳 Creando modelo personalizado llama3.2:1b"
  docker exec dualeat_ollama ollama create llama3.2:1b -f /ollama_models/Modelfile
  if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Modelo llama3.2:1b creado exitosamente."
  } else {
    Write-Host "❌ Error al crear el modelo llama3.2:1b."
  }
}

Write-Host "🎯 Modelos listos para usar."