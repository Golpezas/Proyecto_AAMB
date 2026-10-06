const crypto = require('node:crypto');
const { openRiftImageUrl } = require('./OpenRiftImageCatalog');

const OPENRIFT_CARD_ROOT = 'https://openrift.app/cards';

// Exact English printing image identifiers from OpenRift's public catalog.
// The collector number remains the lookup key, including the printed star.
const OPENRIFT_CARD_IMAGE_IDS = Object.freeze({
  'UNL-078/219': '019d1eea-25eb-7f3b-9c82-885e860c57be',
  'VEN-189*/166': '019ffa4a-ecee-7d5b-a0d3-5493689e46d9',
  'VEN-190*/166': '019ffa5d-3735-7953-a1ea-b70df1447603',
  'VEN-191*/166': '019ffa5d-8d8a-7e2a-9a91-5393faa3d4b4',
  'VEN-192*/166': '019ffa49-b76b-783e-8165-ae8cb24744b5',
  'VEN-193*/166': '019ffa5e-1fe0-73e1-ac35-3682bc0cd3e2',
  'VEN-194*/166': '019ffa5e-7384-7807-9534-1e8648a5a900',
  'VEN-195*/166': '019ffa5e-a98f-7f02-b068-e2536738f6f7',
  'VEN-196*/166': '019ffa5e-d8c6-75a9-b6b5-1485822cb75f',
  'VEN-197*/166': '019ffa5f-10af-7101-b5fc-4592fa91a90f'
});

const VERIFIED_VENDETTA_SIGNATURE_IMAGES = Object.freeze(Object.fromEntries(
  Object.entries(OPENRIFT_CARD_IMAGE_IDS)
    .filter(([number]) => number.startsWith('VEN-'))
    .map(([number, imageId]) => [number, openRiftImageUrl(imageId)])
));

// Kept as an empty compatibility export for older tests/imports. Community
// photos and bundled scans are no longer used by the Riftbound Library.
const BUNDLED_VENDETTA_SIGNATURE_FILES = Object.freeze({});

function bundledVendettaSignaturePath(cardNumber) {
  return BUNDLED_VENDETTA_SIGNATURE_FILES[cardNumber] || '';
}

// Small, verified recovery list for real Riftbound cards omitted from the
// current Riot gallery response. These rows are additive and keyed by their
// collector number, so they never replace another printing or saved card.
const VERIFIED_RIFTBOUND_CARDS = Object.freeze([
  Object.freeze({
    number: 'UNL-078/219',
    imageNumber: 'UNL-078',
    name: 'Sprite Fountain',
    setCode: 'UNL',
    setName: 'Unleashed',
    rarity: 'Uncommon',
    color: 'Mind',
    cardType: 'Gear',
    artist: 'Envar Studio',
    cost: '2',
    power: '1',
    finish: 'Normal',
    effect: "Temporary (Kill this at the start of its controller's Beginning Phase, before scoring.) When you play this, play a ready 3 might Sprite unit token with Temporary to your base. Deathknell: Repeat this gear's play effect. (When this dies, get the effect.)"
  }),
  // Collectr lists the normal and foil finishes separately. Board presets use
  // unique catalog rows, so keep a verified foil-finish row beside the normal
  // card while preserving the same printed collector number and artwork.
  Object.freeze({
    supplementKey: 'UNL-078/219|FOIL',
    distinctVariant: true,
    number: 'UNL-078/219',
    imageNumber: 'UNL-078',
    name: 'Sprite Fountain',
    setCode: 'UNL',
    setName: 'Unleashed',
    rarity: 'Uncommon',
    variant: 'Foil',
    variantSource: 'Verified physical foil finish',
    finish: 'Foil',
    color: 'Mind',
    cardType: 'Gear',
    artist: 'Envar Studio',
    cost: '2',
    power: '1',
    effect: "Temporary (Kill this at the start of its controller's Beginning Phase, before scoring.) When you play this, play a ready 3 might Sprite unit token with Temporary to your base. Deathknell: Repeat this gear's play effect. (When this dies, get the effect.)"
  }),
  // Riot's current Vendetta gallery feed stops at the unsigned Overnumbered
  // records. The nine physical signed Legend printings use the same art and
  // rules with an artist signature and an asterisk collector number.
  Object.freeze({ number: 'VEN-189*/166', imageNumber: 'VEN-189s', name: 'Akali, Rogue Assassin', setCode: 'VEN', setName: 'Vendetta', rarity: 'Rare', variant: 'Signature', color: 'Fury / Calm', cardType: 'Legend', traits: 'Akali', artist: 'Jessica Oyhenart' }),
  Object.freeze({ number: 'VEN-190*/166', imageNumber: 'VEN-190s', name: 'Renekton, Butcher of the Sands', setCode: 'VEN', setName: 'Vendetta', rarity: 'Rare', variant: 'Signature', color: 'Fury / Body', cardType: 'Legend', traits: 'Renekton', artist: 'Edgardo Monteon' }),
  Object.freeze({ number: 'VEN-191*/166', imageNumber: 'VEN-191s', name: 'Zed, Master of Shadows', setCode: 'VEN', setName: 'Vendetta', rarity: 'Rare', variant: 'Signature', color: 'Fury / Chaos', cardType: 'Legend', traits: 'Zed', artist: 'Yh Shen' }),
  Object.freeze({ number: 'VEN-192*/166', imageNumber: 'VEN-192s', name: 'Nasus, Curator of the Sands', setCode: 'VEN', setName: 'Vendetta', rarity: 'Rare', variant: 'Signature', color: 'Calm / Mind', cardType: 'Legend', traits: 'Nasus', artist: '' }),
  Object.freeze({ number: 'VEN-193*/166', imageNumber: 'VEN-193s', name: 'Shen, Eye of Twilight', setCode: 'VEN', setName: 'Vendetta', rarity: 'Rare', variant: 'Signature', color: 'Calm / Order', cardType: 'Legend', traits: 'Shen', artist: '' }),
  Object.freeze({ number: 'VEN-194*/166', imageNumber: 'VEN-194s', name: 'Jayce, Defender of Tomorrow', setCode: 'VEN', setName: 'Vendetta', rarity: 'Rare', variant: 'Signature', color: 'Mind / Body', cardType: 'Legend', traits: 'Jayce', artist: '' }),
  Object.freeze({ number: 'VEN-195*/166', imageNumber: 'VEN-195s', name: "Mel, Soul's Reflection", setCode: 'VEN', setName: 'Vendetta', rarity: 'Rare', variant: 'Signature', color: 'Mind / Order', cardType: 'Legend', traits: 'Mel', artist: '' }),
  Object.freeze({ number: 'VEN-196*/166', imageNumber: 'VEN-196s', name: 'Ambessa, Matriarch of War', setCode: 'VEN', setName: 'Vendetta', rarity: 'Rare', variant: 'Signature', color: 'Body / Order', cardType: 'Legend', traits: 'Ambessa', artist: '' }),
  Object.freeze({ number: 'VEN-197*/166', imageNumber: 'VEN-197s', name: 'Kennen, Heart of the Tempest', setCode: 'VEN', setName: 'Vendetta', rarity: 'Rare', variant: 'Signature', color: 'Chaos / Order', cardType: 'Legend', traits: 'Kennen', artist: 'Shop Sun' })
]);

// Exact lead-card recovery rows for the 23-position Unleashed Board 3. Riot's
// gallery and older local catalogs can differ on collector treatments, so a
// missing lead record must not leave the saved preset stuck at 19 positions.
// Existing richer catalog rows always win; these are inserted only when the
// exact collector number is absent and are later eligible for image hydration.
const VERIFIED_UNLEASHED_BOARD_THREE_ANCHORS = Object.freeze([
  ['UNL-226*/219', 'Jhin, Virtuoso', 'Showcase', 'Signature', 'Fury', 'Unit'],
  ['UNL-227*/219', 'Rengar, Pridestalker', 'Showcase', 'Signature', 'Body', 'Unit'],
  ['UNL-228*/219', 'Pyke, Bloodharbor Ripper', 'Showcase', 'Signature', 'Fury', 'Unit'],
  ['UNL-229*/219', 'Vi, Piltover Enforcer', 'Showcase', 'Signature', 'Fury', 'Unit'],
  ['UNL-230*/219', 'Lillia, Bashful Bloom', 'Showcase', 'Signature', 'Calm', 'Unit'],
  ['UNL-231*/219', 'Master Yi, Wuju Master', 'Showcase', 'Signature', 'Mind', 'Unit'],
  ['UNL-232*/219', 'Vex, Gloomist', 'Showcase', 'Signature', 'Chaos', 'Unit'],
  ['UNL-233*/219', 'Ivern, Green Father', 'Showcase', 'Signature', 'Calm', 'Unit'],
  ['UNL-234*/219', 'Diana, Scorn of the Moon', 'Showcase', 'Signature', 'Chaos', 'Unit'],
  ['UNL-235*/219', 'LeBlanc, Deceiver', 'Showcase', 'Signature', 'Chaos', 'Unit'],
  ["UNL-236*/219", "Kha'Zix, Voidreaver", 'Showcase', 'Signature', 'Body', 'Unit'],
  ['UNL-237*/219', 'Poppy, Keeper of the Hammer', 'Showcase', 'Signature', 'Order', 'Unit'],
  ['UNL-238/219', 'Baron Nashor', 'Showcase', 'Ultimate', 'Chaos', 'Unit'],
  ['UNL-220/219', 'Pouty Poro', 'Showcase', 'Overnumbered', 'Fury', 'Unit'],
  ['UNL-221/219', 'Lonely Poro', 'Showcase', 'Overnumbered', 'Calm', 'Unit'],
  ['UNL-222/219', 'Plundering Poro', 'Showcase', 'Overnumbered', 'Body', 'Unit'],
  ['UNL-223/219', 'Veteran Poro', 'Showcase', 'Overnumbered', 'Mind', 'Unit'],
  ['UNL-224/219', 'Mystic Poro', 'Showcase', 'Overnumbered', 'Chaos', 'Unit'],
  ['UNL-225/219', 'Daring Poro', 'Showcase', 'Overnumbered', 'Order', 'Unit'],
  ['UNL-060A/219', 'Vilemaw', 'Showcase', 'Alternate Art', 'Calm', 'Unit'],
  ['UNL-118A/219', 'Elder Dragon', 'Showcase', 'Alternate Art', 'Body', 'Unit'],
  ['UNL-179A/219', 'Rift Herald', 'Showcase', 'Alternate Art', 'Chaos', 'Unit'],
  ['UNL-112/219', 'Irresistible Faefolk', 'Rare', '', 'Fury', 'Unit']
].map(([number, name, rarity, variant, color, cardType]) => Object.freeze({
  number,
  name,
  setCode: 'UNL',
  setName: 'Unleashed',
  rarity,
  variant,
  color,
  cardType,
  artist: '',
  fallbackOnly: true
})));

// Complete exact-printing fallback for the Vendetta Board 10 chase list.
// The user's Riot gallery may predate Vendetta or omit promo/runic variants.
// These verified rows make the saved listing installable offline instead of
// silently leaving the previous Board 10 in place when a single row is absent.
const VERIFIED_VENDETTA_CHASE_CARDS = Object.freeze([
  ["VEN-167/166","Vi, Destructive","Showcase","Overnumbered","Fury","Unit","Grafit Studio","019d02f1-d14f-769f-9295-9852db692dbe"],
  ["VEN-168/166","Jinx, Demolitionist","Showcase","Overnumbered","Fury","Unit","Grafit Studio","019d02d0-5e54-7087-b49e-aa16e542f0ac"],
  ["VEN-169/166","Zed, From the Shadows","Showcase","Overnumbered","Fury","Unit","华锐","019f51ee-9bf7-7912-8dd2-55442a08e865"],
  ["VEN-170/166","Shen, Scourge of Shadows","Showcase","Overnumbered","Calm","Unit","华锐","019f6f7f-88c7-7a2a-91c8-8b6249b13113"],
  ["VEN-171/166","Riven, Shattered","Showcase","Overnumbered","Calm","Unit","Shawn Lee","019f6f80-c00b-74a3-9da1-8f75581e460c"],
  ["VEN-172/166","Draven, Showboat","Showcase","Overnumbered","Fury","Unit","Shawn Lee","019f6f7f-eaa3-79df-9865-81d80b2d2d5f"],
  ["VEN-173/166","Swain, Visionary","Showcase","Overnumbered","Mind","Unit","JunHuan","019f6d2f-ef3e-7886-b6e7-a18d1f769a37"],
  ["VEN-174/166","Irelia, Fervent","Showcase","Overnumbered","Calm","Unit","JunHuan","019f6f80-6716-7713-b9e0-ec935d39aed2"],
  ["VEN-175/166","Jayce, Man of Progress","Showcase","Overnumbered","Mind","Unit","莺之歌","019f4106-e1da-749b-9d94-0e3ba1f842a8"],
  ["VEN-176/166","Viktor, Innovator","Showcase","Overnumbered","Mind","Unit","莺之歌","019f4109-285f-77fc-9589-41f2d5c1ed40"],
  ["VEN-177/166","Renekton, Brute","Showcase","Overnumbered","Body","Unit","Ziyan Lin","019f67f4-9c22-7cbe-9274-c3ef1e21377f"],
  ["VEN-178/166","Nasus, Guardian of Knowledge","Showcase","Overnumbered","Mind","Unit","Ziyan Lin","019f6f7e-2fbc-7011-b06d-c838b93c196d"],
  ["VEN-179/166","Rengar, Trophy Hunter","Showcase","Overnumbered","Body","Unit","莺之歌","019f5219-d183-7fd0-b630-e529bcf27e54"],
  ["VEN-180/166","Kha'Zix, Evolving Hunter","Showcase","Overnumbered","Body","Unit","莺之歌","019f5219-66cb-778e-9052-091c61334334"],
  ["VEN-181/166","Gangplank, Naval","Showcase","Overnumbered","Body","Unit","Grafit Studio","019f4d47-0f8e-7cfb-936e-8bf9a4ad0b59"],
  ["VEN-182/166","Illaoi, Prophet of the Great Kraken","Showcase","Overnumbered","Chaos","Unit","Grafit Studio","019f4d49-b487-7663-93fa-a918d45c1986"],
  ["VEN-183/166","Diana, No Longer Human","Showcase","Overnumbered","Chaos","Unit","Naifan Zhang","019f6f82-c808-72d6-ab35-bb9980a0c43e"],
  ["VEN-184/166","Leona, Determined","Showcase","Overnumbered","Order","Unit","Naifan Zhang","019f6f83-7cdc-7e45-88bc-afb433a340dd"],
  ["VEN-185/166","Kayle, Justified","Showcase","Overnumbered","Order","Unit","HCuu","019f845b-56dd-71be-9092-53ae2cd662ca"],
  ["VEN-186/166","Morgana, Vindictive","Showcase","Overnumbered","Fury","Unit","Yuande Wu","019f845a-e3d6-7dc1-bea4-90f48f378268"],
  ["VEN-187/166","Ambessa, Respected and Feared","Showcase","Overnumbered","Order","Unit","蛋费鸡丁","019f6518-79d5-774c-acd8-5cddae981698"],
  ["VEN-188/166","Mel, Defiant Soul","Showcase","Overnumbered","Chaos","Unit","Zhongqi Li","019f6f7c-d988-7a95-96b9-9c8a02b5bd20"],
  ["VEN-189/166","Akali, Rogue Assassin","Showcase","Overnumbered","Fury / Calm","Legend","Jessica Oyhenart","019f5217-9811-76c1-a691-a581ed8cc337"],
  ["VEN-190/166","Renekton, Butcher of the Sands","Showcase","Overnumbered","Fury / Body","Legend","Edgardo Monteon","019f5221-e36e-7855-8f23-b19820b7de70"],
  ["VEN-191/166","Zed, Master of Shadows","Showcase","Overnumbered","Fury / Chaos","Legend","Yh Shen","019f4221-c4aa-7119-8a1f-a4c4cd4f9d42"],
  ["VEN-192/166","Nasus, Curator of the Sands","Showcase","Overnumbered","Calm / Mind","Legend","Sean Budanio","019f4d3e-2ab7-70c6-a815-158a9cb70e36"],
  ["VEN-193/166","Shen, Eye of Twilight","Showcase","Overnumbered","Calm / Order","Legend","Oscar Vega","019f4d44-7156-79c6-9870-8013c3940a74"],
  ["VEN-194/166","Jayce, Defender of Tomorrow","Showcase","Overnumbered","Mind / Body","Legend","Stella Chen Yui","019f6f81-0550-77a7-92ac-27082bd4861c"],
  ["VEN-195/166","Mel, Soul's Reflection","Showcase","Overnumbered","Mind / Chaos","Legend","Envar Studio","019f51f5-d8e8-7f90-981b-1265ed669ec0"],
  ["VEN-196/166","Ambessa, Matriarch of War","Showcase","Overnumbered","Body / Order","Legend","Aliya Chen","019f51f6-9d81-71ed-97cc-18f33ab61016"],
  ["VEN-197/166","Kennen, Heart of the Tempest","Showcase","Overnumbered","Chaos / Order","Legend","Shop Sun","019f4218-79b7-753e-86f9-8bb56b0d69c6"],
  ["VEN-019A/166","Renekton, Rage Fueled","Showcase","Alternate Art","Fury","Unit","League Splash Team","019f4223-ce1e-7632-addd-4faa47dec8af"],
  ["VEN-021A/166","Akali, Deadly Weapon","Showcase","Alternate Art","Fury","Unit","Wild Rift Splash Team","019f51f8-ae7a-7025-a118-e900657f3fc4"],
  ["VEN-023A/166","Zed, From the Shadows","Showcase","Alternate Art","Fury","Unit","League Splash Team","019f4c2e-dd95-77c9-bd91-0207142a4b3c"],
  ["VEN-038A/166","Akali, Silent","Showcase","Alternate Art","Calm","Unit","League Splash Team","019f51d3-4fe5-7c32-ae6c-778a6907c1ce"],
  ["VEN-041A/166","Riven, Shattered","Showcase","Alternate Art","Calm","Unit","Envar Studio","019f7139-4da9-730d-9134-97683a77525c"],
  ["VEN-042A/166","Shen, Scourge of Shadows","Showcase","Alternate Art","Calm","Unit","League Splash Team","019f4226-b486-7c6d-95a6-29679a494959"],
  ["VEN-046A/166","Nasus, Ascended","Showcase","Alternate Art","Calm","Unit","League Splash Team","019f5220-af2b-784b-bed9-df27c3897dd6"],
  ["VEN-063A/166","Nasus, Guardian of Knowledge","Showcase","Alternate Art","Mind","Unit","League Splash Team","019f51ea-954f-70da-afd4-2e8bfeee584a"],
  ["VEN-068A/166","Jayce, Brilliant Inventor","Showcase","Alternate Art","Mind","Unit","League Splash Team","019f421a-6e93-7ae5-ba0a-ee8cd9e5a9e7"],
  ["VEN-069A/166","Mel, Newly Awakened","Showcase","Alternate Art","Mind","Unit","Envar Studio","019f4222-317b-7c8b-acd2-5e259907e150"],
  ["VEN-069B/166","Mel, Newly Awakened","Epic","Alternate Art","Mind","Unit","Anna Nikonova","019f8650-458d-77da-a30a-1363cfe20fc4"],
  ["VEN-084A/166","Ambessa, The Wolf","Showcase","Alternate Art","Body","Unit","League Splash Team","019f6f81-9dd1-768b-848b-980a9dd735b4"],
  ["VEN-088A/166","Jayce, Hammer in Hand","Showcase","Alternate Art","Body","Unit","League Splash Team","019f421b-211e-7db1-a670-9d980ea4eb1b"],
  ["VEN-092A/166","Renekton, Brute","Showcase","Alternate Art","Body","Unit","League Splash Team","019f67f4-0134-774c-bcd8-368c0ef7a40a"],
  ["VEN-110A/166","Mel, Defiant Soul","Showcase","Alternate Art","Chaos","Unit","League Splash Team","019f51e0-55e7-7917-854d-c70320ab944d"],
  ["VEN-112A/166","Zed, Without a Sound","Showcase","Alternate Art","Chaos","Unit","League Splash Team","019f4608-e48a-7cb5-900d-69e695d7343d"],
  ["VEN-113A/166","Kennen, Storm of Shuriken","Showcase","Alternate Art","Chaos","Unit","Wild Rift Splash Team","019f6f7b-fa0d-7b61-9bc5-46086be7bd8e"],
  ["VEN-135A/166","Kennen, Keeper of Balance","Showcase","Alternate Art","Order","Unit","League Splash Team","019f4d4f-5073-71e0-9303-4a8a0aa157a5"],
  ["VEN-136A/166","Ambessa, Respected and Feared","Showcase","Alternate Art","Order","Unit","League Splash Team","019f4203-b8ba-76bc-8ad6-e6a21d5d720a"],
  ["VEN-138A/166","Shen, Leader of the Kinkou Order","Showcase","Alternate Art","Order","Unit","League Splash Team","019f4636-be35-721e-9a7e-a6f67cf40e01"],
  ["VEN-139A/166","Akali, Rogue Assassin","Showcase","Alternate Art","Fury / Calm","Legend","Luscima Studio, Allen Song","019ffa51-1bbb-7169-a5ae-f035094870d9"],
  ["VEN-R01A","Fury Rune","Showcase","Alternate Art","Fury","Rune","Greg Ghielmetti","019fae34-e2c3-7b0c-9098-d211b728bc97"],
  ["VEN-R01B","Fury Rune","Showcase","Alternate Art","Fury","Rune","Pixelverse","019f8657-da51-71db-86c7-52deea278859"],
  ["VEN-R02A","Calm Rune","Showcase","Alternate Art","Calm","Rune","Greg Ghielmetti","019fae34-2a2e-79ae-9dfe-97e547666bf0"],
  ["VEN-R02B","Calm Rune","Showcase","Alternate Art","Calm","Rune","Pixelverse","019f8656-6346-731b-a21c-c1384f0a0ae4"],
  ["VEN-R03A","Mind Rune","Showcase","Alternate Art","Mind","Rune","Greg Ghielmetti","019fc1e0-f7c3-708e-9b7d-39a3126e7981"],
  ["VEN-R03B","Mind Rune","Showcase","Alternate Art","Mind","Rune","Pixelverse","019f8658-9f9b-7114-9f1e-98cb74aea484"],
  ["VEN-R04A","Body Rune","Showcase","Alternate Art","Body","Rune","Greg Ghielmetti","019fae32-8178-7261-9697-741940fb90f8"],
  ["VEN-R04B","Body Rune","Showcase","Alternate Art","Body","Rune","Pixelverse","019fc7f8-bd29-7acc-8dc0-92466b1b14a8"],
  ["VEN-R05A","Chaos Rune","Showcase","Alternate Art","Chaos","Rune","Greg Ghielmetti","019fae62-559f-7265-a083-9ecc5a817f7c"],
  ["VEN-R05B","Chaos Rune","Showcase","Alternate Art","Chaos","Rune","Pixelverse","019f8657-24c3-775b-a8ef-53e2c5afb539"],
  ["VEN-R06A","Order Rune","Showcase","Alternate Art","Order","Rune","Greg Ghielmetti","019fae35-a0c8-7372-b7ee-eefff2752dc9"],
  ["VEN-R06B","Order Rune","Showcase","Alternate Art","Order","Rune","Pixelverse","019f8659-49ca-7409-b58c-786a357f457f"],
  ["VEN-021/166","Akali, Deadly Weapon","Epic","","Fury","Unit","莺之歌","019f4109-bdbc-768f-bce0-fb1e4918ca07"],
  ["VEN-022/166","Endless Riches","Epic","","Fury","Gear","Kudos Productions","019f67d0-09fd-7a2a-94ef-32d0ef211839"],
  ["VEN-023/166","Zed, From the Shadows","Epic","","Fury","Unit","Six More Vodka","019f4c2e-e9b8-7d70-a32e-5ec317ab75d8"],
  ["VEN-045/166","Helm of Suppression","Epic","","Calm","Gear","Kudos Productions","019f67e0-4aed-7f50-af7f-8cc91b331662"],
  ["VEN-046/166","Nasus, Ascended","Epic","","Calm","Unit","Six More Vodka","019f5220-9830-7610-b9cf-a6626101f021"],
  ["VEN-067/166","Bottled Constellation","Epic","","Mind","Gear","Kudos Productions","019f51d3-bc6f-73ee-9346-746cc9cb2a93"],
  ["VEN-068/166","Jayce, Brilliant Inventor","Epic","","Mind","Unit","Pandart Studio","019f421a-2e56-781b-a546-b94300376939"],
  ["VEN-069/166","Mel, Newly Awakened","Epic","","Mind","Unit","Pandart Studio","019f4222-1fef-7648-ad5c-9f1f6a8d0b21"],
  ["VEN-090/166","Cataclysmic Duel","Epic","","Body","Spell","Kudos Productions","019f6d04-28a6-7f7c-9bb4-db26076dc00e"],
  ["VEN-091/166","Corrupted Dragon","Epic","","Body","Unit","Envar Studio","019f4c96-8bf2-75d1-bf25-663e38288189"],
  ["VEN-092/166","Renekton, Brute","Epic","","Body","Unit","Six More Vodka","019f67f3-7ee1-7c3e-9de9-294251bcca2d"],
  ["VEN-113/166","Kennen, Storm of Shuriken","Epic","","Chaos","Unit","Six More Vodka","019f5221-3d87-7a5c-9967-90960867e274"],
  ["VEN-114/166","Kharox","Epic","","Chaos","Unit","Six More Vodka","019f6d1b-7535-79e2-bf0b-deb3ddcc1e66"],
  ["VEN-115/166","Ocean Drake","Epic","","Chaos","Unit","Caravan Studio","019f5221-5fdf-77a8-ad08-45a53fe25dab"],
  ["VEN-136/166","Ambessa, Respected and Feared","Epic","","Order","Unit","Pandart Studio","019f4203-7256-7eca-9f38-05bdcfe97235"],
  ["VEN-137/166","Shady Spectacles","Epic","","Order","Gear","Polar Engine Studio","019f4636-222b-7c89-9aa3-44dbc5b37a33"],
  ["VEN-138/166","Shen, Leader of the Kinkou Order","Epic","","Order","Unit","Pandart Studio","019f4636-872d-7bd4-a06c-0b06db9ead69"],
  ["VEN-140/166","Shuriken Flip","Epic","","Fury / Calm","Spell","莺之歌","019f4637-0416-7546-80ef-5f09c217cb44"],
  ["VEN-142/166","Dominus","Epic","","Fury / Body","Spell","小牛设计","019f521e-66f5-71d6-a3db-8423092f4e00"],
  ["VEN-144/166","Death Mark","Epic","","Fury / Chaos","Spell","JunHuan","019f420a-a8e7-7c3d-9f21-7c843333020d"],
  ["VEN-146/166","Siphoning Strike","Epic","","Calm / Mind","Spell","Kudos Productions","019f51f0-da64-7b00-8ca1-36cc5d62e641"],
  ["VEN-148/166","Shadow Dash","Epic","","Calm / Order","Spell","Polar Engine Studio","019f67f6-bbfb-7bd3-ba75-5d487eff735b"],
  ["VEN-150/166","Acceleration Gate","Epic","","Mind / Body","Spell","小牛设计/Kudos Productions","019f6cfa-aadb-7117-9576-56d393dddc9f"],
  ["VEN-152/166","Rebuttal","Epic","","Mind / Chaos","Spell","小牛设计","019f51ef-263c-7f26-b771-ed891bae5e88"],
  ["VEN-154/166","Public Execution","Epic","","Body / Order","Spell","Polar Engine Studio","019f67f2-b56f-7a66-999b-4356e69b4063"],
  ["VEN-156/166","Lightning Rush","Epic","","Chaos / Order","Spell","Kudos Productions","019f4221-5efd-72cc-a447-dc1cfb4c5338"],
  ["VEN-SP1/006","Kai'Sa, Survivor","Showcase","SP","Fury","Unit","Wild Rift Splash Team","019f6f7b-9f14-7d71-9233-117a46842482"],
  ["VEN-SP2/006","Sona, Harmonious","Showcase","SP","Calm","Unit","Wild Rift Splash Team","019f5219-f62d-7487-aa7e-c1a5bfddfe22"],
  ["VEN-SP3/006","Ahri, Inquisitive","Showcase","SP","Mind","Unit","Wild Rift Splash Team","019f4112-a43e-7cf4-abef-4a2950d370d8"],
  ["VEN-SP4/006","Sett, Brawler","Showcase","SP","Body","Unit","Wild Rift Splash Team","019f4113-1a6e-74ce-bcb2-39148208c2d7"],
  ["VEN-SP5/006","Ezreal, Prodigy","Showcase","SP","Chaos","Unit","Wild Rift Splash Team","019f521e-d3ca-7fdb-9f68-54628335b5ae"],
  ["VEN-SP6/006","Lux, Crownguard","Showcase","SP","Order","Unit","Envar Studio","019f521f-335c-7051-86cb-0783dd2d426c"],
  ["VEN-044/166","Astral Heron","Epic","","Calm","Unit","Kudos Productions","019f678d-2118-7bcd-bd36-698a2d96f5db"]
].map(([number, name, rarity, variant, color, cardType, artist, imageId]) => Object.freeze({
  number,
  name,
  setCode: 'VEN',
  setName: 'Vendetta',
  rarity,
  variant,
  color,
  cardType,
  artist,
  imageId,
  fallbackOnly: true
})));

function stableSupplementId(cardNumber) {
  return `riftbound:${crypto.createHash('sha1').update(`verified-card-supplement:${String(cardNumber).toUpperCase()}`).digest('hex')}`;
}

function slug(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function riftboundCardSupplements() {
  return [...VERIFIED_RIFTBOUND_CARDS, ...VERIFIED_UNLEASHED_BOARD_THREE_ANCHORS, ...VERIFIED_VENDETTA_CHASE_CARDS].map(card => ({
    official_id: stableSupplementId(card.supplementKey || card.number),
    game_code: 'RIFTBOUND',
    game_name: 'Riftbound: League of Legends TCG',
    name: card.name,
    card_number: card.number,
    set_code: card.setCode,
    setName: card.setName,
    product_name: `Riftbound: League of Legends TCG — ${card.setName} Booster 6-Box Case`,
    rarity: card.rarity,
    source_rarity: card.rarity,
    variant: card.variant || '',
    variant_source: card.variantSource || (card.variant ? 'Verified physical collector number' : ''),
    color: card.color,
    card_type: card.cardType,
    image_url: openRiftImageUrl(card.imageId || OPENRIFT_CARD_IMAGE_IDS[card.number]),
    image_path: '',
    detail_url: `${OPENRIFT_CARD_ROOT}/${slug(card.name)}`,
    artist: card.artist,
    life: '',
    cost: card.cost,
    attribute: '',
    power: card.power,
    counter: '',
    block: '',
    traits: card.traits || card.cardType,
    effect: card.effect || '',
    raw_details: JSON.stringify({
      supplement: 'Riot public gallery omission matched to an exact OpenRift English printing',
      finish: card.finish || (card.variant === 'Signature' ? 'Foil artist signature' : 'Foil available'),
      rarity: card.rarity,
      artist: card.artist
    }),
    source: 'OpenRift exact English printing supplement',
    distinct_variant: Boolean(card.distinctVariant),
    fallback_only: Boolean(card.fallbackOnly)
  }));
}

module.exports = {
  BUNDLED_VENDETTA_SIGNATURE_FILES,
  OPENRIFT_CARD_IMAGE_IDS,
  VERIFIED_VENDETTA_SIGNATURE_IMAGES,
  VERIFIED_RIFTBOUND_CARDS,
  VERIFIED_UNLEASHED_BOARD_THREE_ANCHORS,
  VERIFIED_VENDETTA_CHASE_CARDS,
  bundledVendettaSignaturePath,
  riftboundCardSupplements,
  stableSupplementId
};
