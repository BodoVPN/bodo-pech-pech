# Bodo Pech Pech

Status: planning only. Implementation has not started.

Bodo Pech Pech is a planned offline, on-device app for two people to protect messages with standard, reviewed encryption and encode the encrypted payload into ordinary-looking Persian cover text.

## Planned requirements

- The sender enters a message, protects it with encryption, and encodes the encrypted payload into Persian cover text on their own device.
- The sender copies the cover text into an existing messenger. The recipient pastes it into their own app to decode and decrypt it, recovering the original message exactly.
- Replies should try to follow the context of the visible cover conversation. Cover text may be long.
- Natural-sounding cover conversation is best effort. There is no guarantee of undetectability.
- Cryptography must use standard, reviewed designs and implementations; it must not be invented from scratch.
- Encoding and decoding must work offline on the device without depending on access to the global internet.
- The existing messenger provides transport. This app is not a replacement messaging network.

## Open decisions

The device platform, key exchange, cryptographic protocol, and cover-text encoding design have not been chosen.

This repository currently contains only this project brief. No application framework, services, deployment, or license has been selected.
