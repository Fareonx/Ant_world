// Söz bazası.
// Hər söz: [söz, yaxın söz]
//  - Yaxın söz eyni kateqoriyadan, oxşar, amma FƏRQLİ bir şeydir
//    (məsələn, «Stul» → «Taburet», «Terlik» → «Sandal»). Nə eyni şey, nə də uzaq.
//  - Klassik rejimdə impostora ipucu kimi, Undercover rejimində isə impostorun
//    sözü kimi göstərilir.

const c = (id, name, emoji, list) => ({
  id,
  name,
  emoji,
  words: list
    .trim()
    .split('\n')
    .map((line) => line.split('|').map((s) => s.trim())),
});

export const CATEGORIES = [
  c('food', 'Yeməklər', '🍽️', `
Plov|Dolma
Dolma|Plov
Qutab|Kətə
Kətə|Qutab
Dövğa|Şorba
Kabab|Şaurma
Lülə kabab|Kotlet
Kotlet|Köftə
Köftə|Kotlet
Küftə bozbaş|Piti
Piti|Bozbaş
Bozbaş|Piti
Xəngəl|Düşbərə
Düşbərə|Pelmeni
Pelmeni|Xinkal
Xinkal|Pelmeni
Şaurma|Dönər
Dönər|Şaurma
Pizza|Lahmacun
Lahmacun|Pizza
Burger|Sendviç
Sendviç|Buterbrod
Hot-doq|Burger
Suşi|Roll
Makaron|Spagetti
Spagetti|Makaron
Lazanya|Pizza
Omlet|Qayğanaq
Qayğanaq|Omlet
Sosiska|Kolbasa
Kolbasa|Sosiska
Kartof fri|Çips
Kartof püresi|Qızardılmış kartof
Salat|Vinegret
Şorba|Borş
Borş|Şorba
Mərci şorbası|Toyuq şorbası
Çörək|Lavaş
Lavaş|Yuxa
Təndir çörəyi|Bulka
Bulka|Kruassan
Kruassan|Bulka
Pirojki|Samsa
Samsa|Pirojki
Xaçapuri|Kökə
Qovurma|Buğlama
Buğlama|Qovurma
Ləvəngi|Qızardılmış toyuq
Toyuq qanadı|Toyuq budu
Balıq|Krevet
Krevet|Balıq
Kürü|Krevet
Sıyıq|Yulaf
Pendir|Kəsmik
Kəsmik|Pendir
Yumurta|Pendir
Kərə yağı|Marqarin
Bal|Mürəbbə
Mürəbbə|Bal
Düyü|Qarabaşaq
`),

  c('fruit', 'Meyvə və tərəvəz', '🍎', `
Alma|Armud
Armud|Heyva
Heyva|Armud
Banan|Manqo
Manqo|Ananas
Ananas|Manqo
Nar|Əncir
Əncir|Xurma
Xurma|Əncir
Üzüm|Kişmiş
Kişmiş|Üzüm
Qarpız|Yemiş
Yemiş|Qarpız
Limon|Laym
Laym|Limon
Portağal|Mandarin
Mandarin|Portağal
Qreypfrut|Portağal
Çiyələk|Moruq
Moruq|Böyürtkən
Böyürtkən|Moruq
Qarağat|Böyürtkən
Gilas|Albalı
Albalı|Gilas
Ərik|Şaftalı
Şaftalı|Nektarin
Nektarin|Şaftalı
Gavalı|Alça
Alça|Gavalı
Zoğal|Alça
Tut|Böyürtkən
Kivi|Feyxoa
Feyxoa|Kivi
Avokado|Manqo
Kokos|Ananas
Pomidor|Bibər
Bibər|Pomidor
Xiyar|Kabaçok
Kabaçok|Badımcan
Badımcan|Kabaçok
Kartof|Batat
Batat|Kartof
Soğan|Sarımsaq
Sarımsaq|Soğan
Yerkökü|Çuğundur
Çuğundur|Turp
Turp|Çuğundur
Kələm|Gül kələm
Gül kələm|Brokkoli
Brokkoli|Gül kələm
Kahı|Ispanaq
Ispanaq|Kahı
Cəfəri|Şüyüd
Şüyüd|Cəfəri
Reyhan|Nanə
Nanə|Reyhan
Balqabaq|Kabaçok
Noxud|Lobya
Lobya|Noxud
Qarğıdalı|Noxud
`),

  c('animals', 'Heyvanlar', '🐾', `
Pişik|İt
İt|Canavar
Canavar|Tülkü
Tülkü|Canavar
Aslan|Pələng
Pələng|Bəbir
Bəbir|Pələng
Fil|Begemot
Begemot|Kərgədan
Kərgədan|Begemot
Zürafə|Dəvə
Dəvə|At
At|Eşşək
Eşşək|At
Zebra|At
İnək|Camış
Camış|İnək
Qoyun|Keçi
Keçi|Qoyun
Toyuq|Xoruz
Xoruz|Toyuq
Ördək|Qaz
Qaz|Ördək
Hinduşka|Toyuq
Pinqvin|Suiti
Suiti|Morj
Morj|Suiti
Delfin|Balina
Balina|Delfin
Köpəkbalığı|Delfin
Ahtapot|Kalmar
Meduza|Ahtapot
Xərçəng|Krevet
Meymun|Qorilla
Qorilla|Şimpanze
Şimpanze|Qorilla
Ayı|Panda
Panda|Koala
Koala|Panda
Kenquru|Dovşan
Dovşan|Dələ
Dələ|Siçan
Siçan|Dələ
Kirpi|Dələ
İlan|Kərtənkələ
Kərtənkələ|Timsah
Timsah|Kərtənkələ
Tısbağa|İlbiz
İlbiz|Tısbağa
Qurbağa|Kərtənkələ
Qartal|Şahin
Şahin|Qartal
Bayquş|Qarğa
Qarğa|Sərçə
Sərçə|Göyərçin
Göyərçin|Sərçə
Tutuquşu|Bülbül
Bülbül|Tutuquşu
Qu quşu|Ördək
Flaminqo|Qu quşu
Kəpənək|Cırcırama
Cırcırama|Kəpənək
Arı|Eşşəkarısı
Eşşəkarısı|Arı
Milçək|Ağcaqanad
Ağcaqanad|Milçək
Qarışqa|Hörümçək
Hörümçək|Qarışqa
Maral|Ceyran
Ceyran|Maral
`),

  c('jobs', 'Peşələr', '👨‍⚕️', `
Həkim|Tibb bacısı
Tibb bacısı|Həkim
Diş həkimi|Həkim
Cərrah|Həkim
Müəllim|Tərbiyəçi
Tərbiyəçi|Müəllim
Professor|Müəllim
Polis|Əsgər
Əsgər|Polis
Mühafizəçi|Polis
Aşpaz|Qənnadçı
Qənnadçı|Aşpaz
Ofisiant|Barmen
Barmen|Ofisiant
Pilot|Stüardessa
Stüardessa|Pilot
Kapitan|Dənizçi
Dənizçi|Kapitan
Yanğınsöndürən|Xilasedici
Xilasedici|Yanğınsöndürən
Bərbər|Stilist
Stilist|Bərbər
Dərzi|Modelyer
Modelyer|Dərzi
Jurnalist|Bloger
Bloger|Jurnalist
Proqramçı|Dizayner
Dizayner|Proqramçı
Rəssam|Heykəltəraş
Heykəltəraş|Rəssam
Fotoqraf|Operator
Operator|Fotoqraf
Hakim|Vəkil
Vəkil|Prokuror
Prokuror|Vəkil
Kosmonavt|Pilot
Müğənni|Aktyor
Aktyor|Müğənni
Rejissor|Aktyor
Sürücü|Kuryer
Kuryer|Poçtalyon
Poçtalyon|Kuryer
Fermer|Çoban
Çoban|Fermer
Bağban|Fermer
Memar|İnşaatçı
İnşaatçı|Memar
Elektrik|Santexnik
Santexnik|Elektrik
Mexanik|Elektrik
Satıcı|Kassir
Kassir|Satıcı
Mühasib|Bankir
Bankir|Mühasib
Psixoloq|Həkim
Sehrbaz|Kloun
Kloun|Sehrbaz
Futbolçu|Məşqçi
Məşqçi|Futbolçu
Kitabxanaçı|Müəllim
Alim|Professor
Dülgər|İnşaatçı
Qəssab|Aşpaz
`),

  c('countries', 'Ölkələr', '🌍', `
Türkiyə|Yunanıstan
Yunanıstan|Türkiyə
Rusiya|Ukrayna
Ukrayna|Belarus
Belarus|Ukrayna
Gürcüstan|Türkiyə
İran|Türkiyə
Qazaxıstan|Özbəkistan
Özbəkistan|Türkmənistan
Türkmənistan|Özbəkistan
Qırğızıstan|Qazaxıstan
Yaponiya|Koreya
Koreya|Yaponiya
Çin|Yaponiya
Hindistan|Pakistan
Pakistan|Hindistan
Misir|Mərakeş
Mərakeş|Tunis
Tunis|Mərakeş
Səudiyyə Ərəbistanı|BƏƏ
BƏƏ|Qətər
Qətər|BƏƏ
İtaliya|İspaniya
İspaniya|Portuqaliya
Portuqaliya|İspaniya
Fransa|Belçika
Belçika|Niderland
Niderland|Belçika
Almaniya|Avstriya
Avstriya|İsveçrə
İsveçrə|Avstriya
İngiltərə|İrlandiya
İrlandiya|Şotlandiya
Şotlandiya|İrlandiya
İsveç|Norveç
Norveç|Finlandiya
Finlandiya|İsveç
Polşa|Çexiya
Çexiya|Polşa
ABŞ|Kanada
Kanada|ABŞ
Meksika|Braziliya
Braziliya|Argentina
Argentina|Braziliya
Avstraliya|Yeni Zelandiya
Yeni Zelandiya|Avstraliya
Tailand|Vyetnam
Vyetnam|Tailand
İndoneziya|Malayziya
Malayziya|İndoneziya
Kuba|Meksika
`),

  c('cities', 'Şəhərlər', '🏙️', `
Bakı|Gəncə
Gəncə|Sumqayıt
Sumqayıt|Bakı
Şuşa|Şəki
Şəki|Qəbələ
Qəbələ|Quba
Quba|Qusar
Qusar|Quba
Lənkəran|Astara
Astara|Lənkəran
Naxçıvan|Ordubad
Ordubad|Naxçıvan
Mingəçevir|Şirvan
Şirvan|Mingəçevir
Şamaxı|İsmayıllı
İsmayıllı|Şamaxı
Zaqatala|Balakən
Balakən|Zaqatala
Xankəndi|Şuşa
Ağdam|Füzuli
Füzuli|Ağdam
Kəlbəcər|Laçın
Laçın|Kəlbəcər
İstanbul|Ankara
Ankara|İzmir
İzmir|Antalya
Antalya|İzmir
Tbilisi|Batumi
Batumi|Tbilisi
Moskva|Sankt-Peterburq
Sankt-Peterburq|Moskva
Paris|London
London|Paris
Roma|Milan
Milan|Roma
Venesiya|Roma
Berlin|Münhen
Münhen|Berlin
Madrid|Barselona
Barselona|Madrid
Nyu-York|Los-Anceles
Los-Anceles|Nyu-York
Las-Veqas|Los-Anceles
Dubay|Abu-Dabi
Abu-Dabi|Dubay
Tokio|Seul
Seul|Tokio
Pekin|Şanxay
Şanxay|Pekin
Tehran|Təbriz
Təbriz|Tehran
Praqa|Vyana
Vyana|Praqa
Amsterdam|Brüssel
`),

  c('sports', 'İdman', '⚽', `
Futbol|Futzal
Futzal|Futbol
Basketbol|Voleybol
Voleybol|Basketbol
Həndbol|Voleybol
Tennis|Badminton
Badminton|Tennis
Stolüstü tennis|Tennis
Reqbi|Futbol
Beysbol|Kriket
Kriket|Beysbol
Qolf|Bilyard
Bilyard|Bouling
Bouling|Bilyard
Xokkey|Kərlinq
Kərlinq|Xokkey
Fiqurlu konkisürmə|Gimnastika
Gimnastika|Akrobatika
Akrobatika|Gimnastika
Boks|Kikboksinq
Kikboksinq|Boks
Güləş|Cüdo
Cüdo|Sambo
Sambo|Cüdo
Karate|Taekvondo
Taekvondo|Karate
Sumo|Güləş
Şahmat|Dama
Dama|Şahmat
Nərd|Domino
Domino|Nərd
Üzgüçülük|Dalğıclıq
Dalğıclıq|Üzgüçülük
Su polosu|Üzgüçülük
Qaçış|Marafon
Marafon|Qaçış
Hündürlüyə tullanma|Uzunluğa tullanma
Uzunluğa tullanma|Hündürlüyə tullanma
Ağır atletika|Bodibildinq
Bodibildinq|Ağır atletika
Xizək|Snoubord
Snoubord|Xizək
Sörfinq|Skeytbord
Skeytbord|Rolik
Rolik|Skeytbord
Velosiped idmanı|Motokros
Motokros|Velosiped idmanı
Formula 1|Ralli
Ralli|Formula 1
Atıcılıq|Oxatma
Oxatma|Atıcılıq
Qılıncoynatma|Oxatma
Dağçılıq|Qayaya dırmanma
Qayaya dırmanma|Dağçılıq
Atçılıq|Çovqan
Çovqan|Atçılıq
Avarçəkmə|Yelkənli idman
Yelkənli idman|Avarçəkmə
`),

  c('home', 'Ev əşyaları', '🏠', `
Divan|Kreslo
Kreslo|Divan
Stul|Taburet
Taburet|Stul
Masa|Jurnal masası
Jurnal masası|Masa
Çarpayı|Divan
Şkaf|Komod
Komod|Şkaf
Rəf|Şkaf
Soyuducu|Dondurucu
Dondurucu|Soyuducu
Paltaryuyan|Qabyuyan
Qabyuyan|Paltaryuyan
Ütü|Paltaryuyan
Fen|Saç düzləşdirici
Tozsoran|Süpürgə
Süpürgə|Tozsoran
Güzgü|Pəncərə
Pəncərə|Qapı
Qapı|Pəncərə
Pərdə|Jalüz
Jalüz|Pərdə
Xalça|Palaz
Palaz|Xalça
Yastıq|Yorğan
Yorğan|Yastıq
Döşək|Yorğan
Lampa|Çilçıraq
Çilçıraq|Lampa
Şam|Lampa
Televizor|Proyektor
Proyektor|Televizor
Saat|Zəngli saat
Zəngli saat|Saat
Kondisioner|Ventilyator
Ventilyator|Kondisioner
Radiator|Kamin
Kamin|Peç
Peç|Kamin
Dəsmal|Xalat
Xalat|Dəsmal
Sabun|Şampun
Şampun|Sabun
Diş fırçası|Diş pastası
Diş pastası|Diş fırçası
Daraq|Saç fırçası
Açar|Kilid
Kilid|Açar
Çətir|Plaş
Vaza|Saksı
Saksı|Vaza
Şəkil çərçivəsi|Güzgü
Asılqan|Şkaf
Zibil qabı|Zibil torbası
`),

  c('kitchen', 'Mətbəx', '🍳', `
Qazan|Tava
Tava|Qazan
Çaydan|Samovar
Samovar|Çaydan
Bıçaq|Qayçı
Qayçı|Bıçaq
Qaşıq|Çəngəl
Çəngəl|Qaşıq
Çay qaşığı|Qaşıq
Boşqab|Kasa
Kasa|Boşqab
Stəkan|Fincan
Fincan|Stəkan
Armudu stəkan|Fincan
Nimçə|Boşqab
Sini|Nimçə
Mikrodalğalı soba|Duxovka
Soba|Duxovka
Duxovka|Mikrodalğalı soba
Blender|Mikser
Mikser|Blender
Toster|Qril
Qril|Toster
Qəhvə maşını|Çaydan
Sürtgəc|Bıçaq
Kəfgir|Çömçə
Çömçə|Kəfgir
Oxlov|Sürtgəc
Ələk|Kəfgir
Termos|Çaydan
Butulka|Banka
Banka|Butulka
Duzqabı|İstiotqabı
İstiotqabı|Duzqabı
Qənddan|Duzqabı
Folqa|Streç plyonka
Doğrama taxtası|Bıçaq
Önlük|Mətbəx əlcəyi
Mətbəx əlcəyi|Önlük
Süngər|Dəsmal
Cezve|Qəhvə maşını
Dəmlik|Çaydan
Mətbəx tərəzisi|Ölçü stəkanı
Ölçü stəkanı|Mətbəx tərəzisi
Piyalə|Kasa
Sac|Tava
Manqal|Qril
Şampur|Manqal
Qəlib|Tava
Sukəmər|Qazan
`),

  c('transport', 'Nəqliyyat', '🚗', `
Avtomobil|Taksi
Taksi|Avtomobil
Avtobus|Trolleybus
Trolleybus|Avtobus
Marşrut taksi|Avtobus
Metro|Tramvay
Tramvay|Metro
Qatar|Elektrik qatarı
Elektrik qatarı|Qatar
Təyyarə|Helikopter
Helikopter|Təyyarə
Gəmi|Bərə
Bərə|Gəmi
Qayıq|Yaxta
Yaxta|Qayıq
Kater|Yaxta
Velosiped|Motosiklet
Motosiklet|Skuter
Skuter|Motosiklet
Samokat|Velosiped
Raket|Peyk
Yük maşını|Furqon
Furqon|Yük maşını
Traktor|Kombayn
Kombayn|Traktor
Təcili yardım|Yanğın maşını
Yanğın maşını|Təcili yardım
Polis maşını|Təcili yardım
Hava şarı|Dirijabl
Dirijabl|Hava şarı
Paraşüt|Deltaplan
Deltaplan|Paraşüt
Kanat yolu|Lift
Lift|Eskalator
Eskalator|Lift
Kirşə|Araba
Araba|Fayton
Fayton|Araba
Sualtı qayıq|Gəmi
Limuzin|Avtomobil
Kabriolet|Limuzin
Cip|Avtomobil
Ekskavator|Traktor
Kran|Ekskavator
Monoreyka|Metro
Kvadrosikl|Motosiklet
Yarış maşını|Kabriolet
Uşaq arabası|Kirşə
Katamaran|Qayıq
Planer|Deltaplan
`),

  c('places', 'Məkanlar', '📍', `
Məktəb|Universitet
Universitet|Məktəb
Uşaq bağçası|Məktəb
Xəstəxana|Poliklinika
Poliklinika|Xəstəxana
Aptek|Poliklinika
Hava limanı|Vağzal
Vağzal|Avtovağzal
Avtovağzal|Vağzal
Çimərlik|Hovuz
Hovuz|Akvapark
Akvapark|Hovuz
Kinoteatr|Teatr
Teatr|Kinoteatr
Muzey|Qalereya
Qalereya|Muzey
Kitabxana|Kitab mağazası
Kitab mağazası|Kitabxana
Restoran|Kafe
Kafe|Restoran
Çayxana|Kafe
Supermarket|Bazar
Bazar|Supermarket
Ticarət mərkəzi|Supermarket
Park|Bağ
Bağ|Park
Zoopark|Sirk
Sirk|Zoopark
İdman zalı|Stadion
Stadion|İdman zalı
Bank|Poçt
Poçt|Bank
Ofis|Fabrik
Fabrik|Zavod
Otel|Hostel
Hostel|Otel
Toy şadlığı|Restoran
Mağara|Tunel
Həbsxana|Polis bölməsi
Polis bölməsi|Həbsxana
Qəsr|Saray
Saray|Qəsr
Bərbərxana|Gözəllik salonu
Gözəllik salonu|Bərbərxana
Hamam|Sauna
Sauna|Hamam
Yanacaqdoldurma məntəqəsi|Avtoyuma
Avtoyuma|Yanacaqdoldurma məntəqəsi
Ferma|Kənd
Kənd|Ferma
Liman|Hava limanı
Planetari|Muzey
Əyləncə parkı|Akvapark
`),

  c('azerbaijan', 'Azərbaycan', '🇦🇿', `
Qız Qalası|Şirvanşahlar sarayı
Şirvanşahlar sarayı|Qız Qalası
Alov qüllələri|Televiziya qülləsi
Televiziya qülləsi|Alov qüllələri
Bulvar|Fəvvarələr meydanı
Fəvvarələr meydanı|Bulvar
İçərişəhər|Qız Qalası
Novruz|Çərşənbə
Çərşənbə|Novruz
Tonqal|Fişəng
Səməni|Buğda
Xarıbülbül|Lalə
Tar|Kamança
Kamança|Tar
Saz|Tar
Balaban|Zurna
Zurna|Balaban
Nağara|Qoşa nağara
Qoşa nağara|Nağara
Muğam|Meyxana
Meyxana|Muğam
Aşıq|Xanəndə
Xanəndə|Aşıq
Xalça|Kilim
Kilim|Xalça
Kəlağayı|Şal
Papaq|Çuxa
Çuxa|Papaq
Qobustan|Palçıq vulkanları
Palçıq vulkanları|Qobustan
Yanardağ|Atəşgah
Atəşgah|Yanardağ
Şahdağ|Tufandağ
Tufandağ|Şahdağ
Göygöl|Maralgöl
Maralgöl|Göygöl
Şəki Xan sarayı|Şirvanşahlar sarayı
Dədə Qorqud|Koroğlu
Koroğlu|Dədə Qorqud
Molla Nəsrəddin|Bəhlul Danəndə
Bəhlul Danəndə|Molla Nəsrəddin
Nizami Gəncəvi|Məhəmməd Füzuli
Məhəmməd Füzuli|İmadəddin Nəsimi
İmadəddin Nəsimi|Məhəmməd Füzuli
Üzeyir Hacıbəyli|Qara Qarayev
Qara Qarayev|Üzeyir Hacıbəyli
Şərbət|Çay
Çay|Şərbət
Paxlava|Şəkərbura
Şəkərbura|Paxlava
Şorqoğal|Şəkərbura
Halva|Paxlava
Kosa və Keçəl|Novruz
`),

  c('clothes', 'Geyim və aksesuar', '👕', `
Köynək|Futbolka
Futbolka|Köynək
Bluzka|Köynək
Cins şalvar|Şalvar
Şalvar|Cins şalvar
Şort|Şalvar
Don|Yubka
Yubka|Don
Kostyum|Pencək
Pencək|Jilet
Jilet|Pencək
Qalstuk|Kəpənək qalstuk
Kəpənək qalstuk|Qalstuk
Şərf|Şal
Şal|Şərf
Kepka|Şlyapa
Şlyapa|Kepka
Toxunma papaq|Kepka
Əlcək|Corab
Corab|Əlcək
Ayaqqabı|Çəkmə
Çəkmə|Ayaqqabı
Krossovka|Kedlər
Kedlər|Krossovka
Terlik|Sandal
Sandal|Terlik
Pijama|Xalat
Gödəkcə|Palto
Palto|Gödəkcə
Plaş|Palto
Sviter|Hudi
Hudi|Sviter
Kofta|Sviter
Eynək|Günəş eynəyi
Günəş eynəyi|Eynək
Qol saatı|Bilərzik
Bilərzik|Qol saatı
Üzük|Sırğa
Sırğa|Boyunbağı
Boyunbağı|Sırğa
Çanta|Bel çantası
Bel çantası|Çanta
Pul kisəsi|Çanta
Kəmər|Asqı
Mayo|Bikini
Bikini|Mayo
Uniforma|Kostyum
Kombinezon|Pijama
Smokinq|Kostyum
Gəlinlik|Don
`),

  c('music', 'Musiqi', '🎵', `
Gitara|Ukulele
Ukulele|Gitara
Elektro gitara|Bas gitara
Bas gitara|Elektro gitara
Piano|Sintezator
Sintezator|Piano
Royal|Piano
Skripka|Violonçel
Violonçel|Skripka
Kontrabas|Violonçel
Baraban|Təbil
Təbil|Baraban
Truba|Saksafon
Saksafon|Truba
Trombon|Truba
Fleyta|Klarnet
Klarnet|Fleyta
Arfa|Piano
Akkordeon|Qarmon
Qarmon|Akkordeon
Ağız qarmonu|Fleyta
Mikrofon|Qulaqlıq
Qulaqlıq|Mikrofon
Dinamik|Qulaqlıq
Karaoke|Konsert
Konsert|Festival
Festival|Konsert
Rep|Hip-hop
Hip-hop|Rep
Rok|Metal
Metal|Rok
Caz|Blüz
Blüz|Caz
Pop|Disko
Disko|Pop
Klassik musiqi|Opera
Opera|Balet
Balet|Opera
Orkestr|Xor
Xor|Orkestr
Ansambl|Orkestr
Himn|Marş
Marş|Himn
Not|Akkord
Akkord|Not
DJ|Prodüser
Prodüser|DJ
Müğənni|Reper
Reper|Müğənni
Dirijor|Bəstəkar
Bəstəkar|Dirijor
Albom|Sinql
Sinql|Albom
Laylay|Mahnı
Klip|Konsert
`),

  c('tech', 'Texnologiya', '📱', `
Telefon|Planşet
Planşet|Telefon
Noutbuk|Kompüter
Kompüter|Noutbuk
Monitor|Televizor
Smart saat|Fitnes qolbağı
Fitnes qolbağı|Smart saat
Robot|Süni intellekt
Süni intellekt|Robot
Dron|Radioidarəli maşın
Wi-Fi|Bluetooth
Bluetooth|Wi-Fi
Selfi|Video
Video|Foto
Emoji|Stiker
Stiker|Emoji
Oyun konsolu|VR eynək
VR eynək|Oyun konsolu
Powerbank|Şarj cihazı
Şarj cihazı|Powerbank
Kabel|Adapter
Adapter|Kabel
Printer|Skaner
Skaner|Printer
Kamera|Veb-kamera
Veb-kamera|Kamera
Klaviatura|Kompüter siçanı
Kompüter siçanı|Klaviatura
Fləş kart|Yaddaş kartı
Yaddaş kartı|Fləş kart
Parol|PIN kod
PIN kod|Parol
Sosial şəbəkə|Messencer
Messencer|Sosial şəbəkə
E-poçt|SMS
SMS|E-poçt
Naviqator|Xəritə
Xəritə|Naviqator
QR kod|Ştrix kod
Ştrix kod|QR kod
Batareya|Akkumulyator
Router|Modem
Modem|Router
Proqram|Tətbiq
Tətbiq|Proqram
Vebsayt|Bloq
Bloq|Vebsayt
Elektron kitab|Planşet
Pult|Coystik
Coystik|Pult
Smart dinamik|Qulaqlıq
Ekran|Monitor
`),

  c('nature', 'Təbiət və hava', '🌳', `
Göy qurşağı|Qütb parıltısı
Qütb parıltısı|Göy qurşağı
Şimşək|Göy gurultusu
Göy gurultusu|Şimşək
Vulkan|Zəlzələ
Zəlzələ|Vulkan
Dəniz|Okean
Okean|Dəniz
Göl|Gölməçə
Gölməçə|Göl
Bulaq|Şəlalə
Şəlalə|Bulaq
Dağ|Təpə
Təpə|Dağ
Qaya|Uçurum
Uçurum|Qaya
Dərə|Kanyon
Kanyon|Dərə
Meşə|Cəngəllik
Cəngəllik|Meşə
Səhra|Çöl
Çöl|Səhra
Ada|Yarımada
Yarımada|Ada
Ay|Günəş
Günəş|Ay
Ulduz|Planet
Planet|Ulduz
Kometa|Meteorit
Meteorit|Kometa
Bulud|Duman
Duman|Bulud
Qar|Dolu
Dolu|Qar
Yağış|Çiskin
Çiskin|Yağış
Tufan|Qasırğa
Qasırğa|Tornado
Tornado|Qasırğa
Külək|Tufan
Ağac|Kol
Kol|Ağac
Gül|Lalə
Lalə|Gül
Kaktus|Aloe
Aloe|Kaktus
Payız|Bahar
Bahar|Payız
Qış|Yay
Yay|Qış
Şaxta|Qırov
Qırov|Şaxta
Buzlaq|Aysberq
Aysberq|Buzlaq
`),

  c('movies', 'Film və cizgi filmləri', '🎬', `
Titanik|Avatar
Avatar|Titanik
Harri Potter|Üzüklərin hökmdarı
Üzüklərin hökmdarı|Harri Potter
Hobbit|Üzüklərin hökmdarı
Şrek|Buz dövrü
Buz dövrü|Şrek
Madaqaskar|Aslan kral
Aslan kral|Madaqaskar
Tom və Cerri|Mikki Maus
Mikki Maus|Tom və Cerri
Spayder-Men|Betmen
Betmen|Supermen
Supermen|Betmen
Dəmir adam|Kapitan Amerika
Kapitan Amerika|Dəmir adam
Hulk|Tor
Tor|Hulk
Frozen|Rapunzel
Rapunzel|Frozen
Nemo|Su pərisi
Su pərisi|Nemo
Matrix|Terminator
Terminator|Matrix
Arşın mal alan|O olmasın, bu olsun
O olmasın, bu olsun|Arşın mal alan
Kinq Konq|Qodzilla
Qodzilla|Kinq Konq
Pinokkio|Çippolino
Çippolino|Pinokkio
Maşa və Ayı|Smeşariki
Smeşariki|Maşa və Ayı
Ninja tısbağalar|Transformerlər
Transformerlər|Ninja tısbağalar
Ceyms Bond|Missiya: Mümkünsüz
Missiya: Mümkünsüz|Ceyms Bond
Ulduz döyüşləri|Ulduzlararası
Ulduzlararası|Ulduz döyüşləri
Yura dövrü parkı|Kinq Konq
Oyuncaqlar tarixçəsi|Maşınlar
Maşınlar|Oyuncaqlar tarixçəsi
Minyonlar|Şrek
Kunq-fu Panda|Madaqaskar
Simpsonlar|Sünger Bob
Sünger Bob|Simpsonlar
Evdə tək|Maska
Maska|Evdə tək
Forsaj|Transformerlər
Karib dənizi quldurları|Hobbit
Zoopolis|Kunq-fu Panda
`),

  c('sweets', 'İçkilər və şirniyyat', '🍰', `
Yaşıl çay|Qara çay
Qara çay|Yaşıl çay
Qəhvə|Kakao
Kakao|Qəhvə
Kapuçino|Latte
Latte|Kapuçino
Espresso|Amerikano
Amerikano|Espresso
Kompot|Şirə
Şirə|Kompot
Limonad|Kola
Kola|Limonad
Mineral su|Qazlı su
Qazlı su|Mineral su
Ayran|Kefir
Kefir|Ayran
Süd|Kefir
Milkşeyk|Smuzi
Smuzi|Milkşeyk
Şokolad|Konfet
Konfet|Şokolad
Karamel|Konfet
Tort|Pirojna
Pirojna|Tort
Kek|Mafin
Mafin|Kek
Peçenye|Kraker
Kraker|Peçenye
Vafli|Peçenye
Dondurma|Sorbet
Sorbet|Dondurma
Ponçik|Pişi
Pişi|Ponçik
Blinçik|Vafli
Lokum|Marmelad
Marmelad|Lokum
Zefir|Marmelad
Saqqız|Konfet
Popkorn|Pambıq konfet
Pambıq konfet|Popkorn
Puding|Jele
Jele|Puding
Çizkeyk|Tiramisu
Tiramisu|Çizkeyk
Qozinaq|Şokolad batonu
Şokolad batonu|Qozinaq
Qoğal|Kətə
Rulet|Tort
Eskimo|Dondurma
`),

  c('school', 'Məktəb və ofis', '✏️', `
Qələm|Karandaş
Karandaş|Qələm
Pozan|Korrektor
Korrektor|Pozan
Xətkeş|Bucaqölçən
Bucaqölçən|Xətkeş
Pərgar|Bucaqölçən
Dəftər|Bloknot
Bloknot|Dəftər
Kitab|Jurnal
Jurnal|Qəzet
Qəzet|Jurnal
Yazı lövhəsi|Flipçart
Təbaşir|Marker
Marker|Flomaster
Flomaster|Marker
Rəngli karandaş|Flomaster
Yapışqan|Skotç
Skotç|Yapışqan
Stepler|Sancaq
Sancaq|Stepler
Qovluq|Zərf
Zərf|Qovluq
Portfel|Penal
Penal|Portfel
Kalkulyator|Çötkə
Çötkə|Kalkulyator
Qlobus|Xəritə
Atlas|Qlobus
Lüğət|Ensiklopediya
Ensiklopediya|Lüğət
Diktant|İnşa
İnşa|Diktant
İmtahan|Test
Test|İmtahan
Tənəffüs|Dərs
Dərs|Tənəffüs
Ev tapşırığı|Kontrol yazı
Kontrol yazı|Ev tapşırığı
Gündəlik|Dəftər
Sinif|Auditoriya
Auditoriya|Sinif
Diplom|Attestat
Attestat|Diplom
Möhür|İmza
İmza|Möhür
Kağız|Karton
Karton|Kağız
Ofis kreslosu|Stul
Kserokopiya|Printer
`),

  c('toys', 'Oyuncaq və oyunlar', '🧸', `
Kukla|Ayıcıq
Ayıcıq|Kukla
Top|Şar
Şar|Top
Uçurtma|Kağız təyyarə
Kağız təyyarə|Uçurtma
Lego|Kubik
Kubik|Lego
Pazl|Rubik kubu
Rubik kubu|Pazl
Yo-yo|Fırfıra
Fırfıra|Yo-yo
Gizlənpaç|Tutmaca
Tutmaca|Gizlənpaç
Gözbağlıca|Gizlənpaç
Tullanma ipi|Halqa
Halqa|Tullanma ipi
Yelləncək|Sürüşkən
Sürüşkən|Yelləncək
Batut|Yelləncək
Kart oyunu|Loto
Loto|Kart oyunu
Monopoliya|Loto
Mafiya|Krokodil
Krokodil|Mafiya
Dart|Sapand
Sapand|Dart
Oyuncaq maşın|Radioidarəli maşın
Radioidarəli maşın|Oyuncaq maşın
Oyuncaq qatar|Oyuncaq maşın
Sabun köpüyü|Şar
Plastilin|Kinetik qum
Kinetik qum|Plastilin
Barbi|Ken
Ken|Barbi
Kompüter oyunu|Mobil oyun
Mobil oyun|Kompüter oyunu
Minecraft|Roblox
Roblox|Minecraft
Fortnite|PUBG
PUBG|Fortnite
Tetris|İlan oyunu
İlan oyunu|Tetris
Viktorina|Sual-cavab
Sual-cavab|Viktorina
Krossvord|Skanvord
Skanvord|Krossvord
Sudoku|Krossvord
Qum saatı|Zər
Zər|Qum saatı
`),

  c('events', 'Bayram və tədbirlər', '🎉', `
Toy|Nişan
Nişan|Toy
Xınayaxdı|Nişan
Ad günü|Yubiley
Yubiley|Ad günü
Yeni il|Ad günü
Məzuniyyət|Son zəng
Son zəng|Məzuniyyət
Bilik günü|Son zəng
Hellouin|Maskarad
Maskarad|Hellouin
Piknik|Kamp
Kamp|Piknik
Sevgililər günü|8 Mart
8 Mart|Sevgililər günü
Ziyafət|Qonaqlıq
Qonaqlıq|Ziyafət
Ekskursiya|Səyahət
Səyahət|Ekskursiya
Olimpiada|Çempionat
Çempionat|Olimpiada
Sürpriz ziyafət|Ad günü
Fişəng şousu|Konsert
Uşaq bayramı|Ad günü
Tələbə gecəsi|Məzuniyyət
`),
];

export function getCategory(id) {
  return CATEGORIES.find((cat) => cat.id === id);
}

export const TOTAL_WORDS = CATEGORIES.reduce((n, cat) => n + cat.words.length, 0);
