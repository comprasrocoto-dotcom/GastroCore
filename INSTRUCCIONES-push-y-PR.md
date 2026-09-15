# Instrucciones para subir la rama y abrir el PR de GastroCore

Estas instrucciones son para que las corra alguien con una terminal (git instalado)
y acceso de escritura a https://github.com/comprasrocoto-dotcom/GastroCore
(por ejemplo, ya haber hecho `git push` a este repo antes desde esa computadora).

## 1. Tené a mano el archivo `GastroCore-migracion-fase3-seguridad-y-datos.bundle`
(el que Claude ya entregó en el chat). Guardalo en una carpeta, por ejemplo tu Escritorio.

## 2. Abrí una terminal ahí y corré, uno por uno:

```bash
git clone https://github.com/comprasrocoto-dotcom/GastroCore.git
cd GastroCore
git fetch /ruta/completa/a/GastroCore-migracion-fase3-seguridad-y-datos.bundle refs/heads/migracion-fase3-seguridad-y-datos:migracion-fase3-seguridad-y-datos
git push origin migracion-fase3-seguridad-y-datos
```

(Reemplazá `/ruta/completa/a/` por donde hayas guardado el archivo `.bundle`. Si estás en Windows
con Git Bash, algo como `C:/Users/TuUsuario/Desktop/GastroCore-migracion-fase3-seguridad-y-datos.bundle`
o el equivalente `/c/Users/TuUsuario/Desktop/...`.)

Si el push pide usuario/contraseña o token, usalo como lo usás normalmente para este repo
(Claude nunca debe pedirte ni ver esas credenciales).

## 3. Abrí el Pull Request

Opción A (más fácil): abrí este link, que ya viene con el título y la descripción completos
del PR precargados — solo hay que revisar y tocar "Create pull request":

(ver archivo `pr_link.txt` adjunto — es muy largo para pegar acá sin romperse)

Opción B (manual, por si el link no carga bien): andá a
https://github.com/comprasrocoto-dotcom/GastroCore/compare/main...migracion-fase3-seguridad-y-datos
hacé clic en "Create pull request", y copiá el título y la descripción desde
`pr_titulo_y_descripcion.md` (adjunto).

## 4. Avisá acá el link del PR una vez abierto

Así queda registrado en esta conversación.
