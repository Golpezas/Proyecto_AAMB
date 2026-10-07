# Checklist para el cliente (prueba real)

Nosotros no hacemos shows live. Esto lo valida el cliente en su máquina / Whatnot cuando haya URL pública o un build que le pasemos.

## Antes

- [ ] BreakSuite6 abre y el break sigue igual (Break Board, Breaker Center, Conector)
- [ ] En **Notify** están Backend URL, Channel ID y API Key (`pin_sk_…`)
- [ ] “Check connection” muestra conectado
- [ ] Link `/join/<handle>` listo para pegar en el perfil o el chat

## Fan

- [ ] Abrir `/join/<handle>` en el teléfono o PC
- [ ] Entrar con Privy, suscribirse, aceptar notificaciones
- [ ] Queda “You're in”

## Ping manual

- [ ] En Notify, escribir un mensaje ≤160 caracteres → **Send Ping**
- [ ] El fan recibe el push
- [ ] El contador de destinatarios tiene sentido

## Go live automático

- [ ] En Notify, dejar **Auto go-live on Prepare Show** encendido
- [ ] En el Conector: Prepare Show hasta **SHOW READY**
- [ ] El fan recibe aviso de en vivo
- [ ] Si PIN está caído o la key es mala, el break y el Conector siguen igual

## Baja

- [ ] El fan se da de baja en `/join/<handle>`
- [ ] El siguiente ping no le llega

## Si algo falla

Anotar: hora, handle, qué pantalla, mensaje de error en Notify, si el Conector seguía en SHOW READY.
