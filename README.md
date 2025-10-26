# Clanker Town

Deployed Sui testnet package: **0x6be6a9f260939c73bdfb9ee3b6fe780e4bcde06b2f4c5ec3d90ca710b511b2a0**

## Overview

Clanker Town is a simulation / web-browser video game which lets player enter the town filled with other autonomous AI agents communicating between each other, gathering resources and trading.

### Game Loop

When player start the game they are dropped into a new match with few AI agents with distinctive personas and character traits, wallets and resources in the inventory.

Initially all generators are not owned by anyone and can be captured either by agents or the player, once that happens the generator starts generating resources which can be claimed periodically, once agent/player has enough rsources they can upgrade the generator.

### Hostility / Friendliness

In order to progress faster in game player can either start acting hostile by capturing agent's generator or be friendly to them, befriend them and bargain for lgood terms for trading rsources with them.

## Setup

### Move

`sui move build`

`sui client publish --gas-budget 100000000  `

```
sui client call \
  --package 0x6be6a9f260939c73bdfb9ee3b6fe780e4bcde06b2f4c5ec3d90ca710b511b2a0 \
  --module resource_game \
  --function create_match \
  --args \
    "[0x6bbe81cd8e3d0435adf5ab3b3fca7c4319abd18104fd78a663e4af118030079d,0x3c2b7961093edaf577879f1ca9fc709f593b8f42c2c9052166d8464606a20cc9]" \
    100 \
    100 \
    50 \
  --gas-budget 10000000
```

```
sui client call \
  --package 0x6be6a9f260939c73bdfb9ee3b6fe780e4bcde06b2f4c5ec3d90ca710b511b2a0 \
  --module resource_game \
  --function create_generators \
  --args \
    0x10465d92c03ddc1949dd5821c3a2a52db80c4b0f60364462ec1e0aef5274418d \
    0 \
    "[10,30,50]" \
    "[20,40,60]" \
    0x6 \
  --gas-budget 10000000
```

Object Changes │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Created Objects: │
│ ┌── │
│ │ ObjectID: 0x62590d2ca276c6b236dd191d8845c2ed1c237b93a4821da8fbc66cbfbdb02aa0 │
│ │ Sender: 0x6bbe81cd8e3d0435adf5ab3b3fca7c4319abd18104fd78a663e4af118030079d │
│ │ Owner: Shared( 628834346 ) │
│ │ ObjectType: 0x6be6a9f260939c73bdfb9ee3b6fe780e4bcde06b2f4c5ec3d90ca710b511b2a0::resource_game::Generator │
│ │ Version: 628834346 │
│ │ Digest: 9nvccftv7oc3JMLLsdHBiLfy4j3iePczp6dsqaEPKpcT │
│ └── │
│ ┌── │
│ │ ObjectID: 0x9543ee75315a9968c4ce45cc7383ae43e67b9826405f3737fcdf945ed23db499 │
│ │ Sender: 0x6bbe81cd8e3d0435adf5ab3b3fca7c4319abd18104fd78a663e4af118030079d │
│ │ Owner: Shared( 628834346 ) │
│ │ ObjectType: 0x6be6a9f260939c73bdfb9ee3b6fe780e4bcde06b2f4c5ec3d90ca710b511b2a0::resource_game::Generator │
│ │ Version: 628834346 │
│ │ Digest: edoXUikfVbSemUa5hpo4ooZ2hjbXYCrdao2QdNzmAQK │
│ └── │
│ ┌── │
│ │ ObjectID: 0x9d275f416155a7632d86630c6002061708fb5329fddaa4f218c5db5426e4ed90 │
│ │ Sender: 0x6bbe81cd8e3d0435adf5ab3b3fca7c4319abd18104fd78a663e4af118030079d │
│ │ Owner: Shared( 628834346 ) │
│ │ ObjectType: 0x6be6a9f260939c73bdfb9ee3b6fe780e4bcde06b2f4c5ec3d90ca710b511b2a0::resource_game::Generator │
│ │ Version: 628834346 │
│ │ Digest: 9W8d5hGXXNCTuoobYX4tJEJ7fBJwunkJ5u1Zit8XhRNr │
│ └── │
│ Mutated Objects: │
│ ┌── │
│ │ ObjectID: 0xa5d411b7e85fca0124d67656cdf91157244058d57d00bb8efe9649c07d6a996b │
│ │ Sender: 0x6bbe81cd8e3d0435adf5ab3b3fca7c4319abd18104fd78a663e4af118030079d │
│ │ Owner: Account Address ( 0x6bbe81cd8e3d0435adf5ab3b3fca7c4319abd18104fd78a663e4af118030079d ) │
│ │ ObjectType: 0x2::coin::Coin<0x2::sui::SUI> │
│ │ Version: 628834346 │
│ │ Digest: 2V18rvueWwNE8PWNZs25r1HFnM3Z3PYdHxGNasm6eJ3X │
│ └── │

```
sui client call \
  --package 0x6be6a9f260939c73bdfb9ee3b6fe780e4bcde06b2f4c5ec3d90ca710b511b2a0 \
  --module resource_game \
  --function claim_generator \
  --args \
    "0x10465d92c03ddc1949dd5821c3a2a52db80c4b0f60364462ec1e0aef5274418d" \
    "0x62590d2ca276c6b236dd191d8845c2ed1c237b93a4821da8fbc66cbfbdb02aa0" \
    "0x6" \
  --gas-budget 10000000
```

```
sui client call \
  --package 0x6be6a9f260939c73bdfb9ee3b6fe780e4bcde06b2f4c5ec3d90ca710b511b2a0 \
  --module resource_game \
  --function claim_resources \
  --args \
    "0x62590d2ca276c6b236dd191d8845c2ed1c237b93a4821da8fbc66cbfbdb02aa0" \
    "0x7c33b7812f8279ec64d03ff90c173f61721240d13e3ba8ba7e19b1e60c74df27" \
    "0x6" \
  --gas-budget 10000000
```

### Frontend

`cd frontend`
`pnpm i`
`pnpm run dev`

### Backend

`cd agent_backend`
`pnpm i`
`pnpm run dev`
