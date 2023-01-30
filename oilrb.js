import TelegramBot from "node-telegram-bot-api"
import {savehistory} from './modules/db.js'
import axios from "axios";
import vision from '@google-cloud/vision';
import {GoogleAuth, grpc} from 'google-gax';

//import {gameOptions, newgameOptions} from './modules/options.js'
import dotenv from "dotenv"
import fs from "fs"
import fetch  from "node-fetch"
import jsdom  from "jsdom"
dotenv.config()

const bot = new TelegramBot(process.env.TG_TOKEN, {polling: true})

let checkRequest = false



function getApiKeyCredentials() {
  const sslCreds = grpc.credentials.createSsl();
  const googleAuth = new GoogleAuth();
  const authClient = googleAuth.fromAPIKey(process.env.GOOGLE_APIKEY);
  const credentials = grpc.credentials.combineChannelCredentials(
    sslCreds,
    grpc.credentials.createFromGoogleCredential(authClient)
  );
  return credentials;
}

const runcheck = async (chatid, text) => {

     let textChek = text.trim().replaceAll(' ', '').replaceAll('/', '').replaceAll('\\', '')
     textChek = transliterate(textChek)
     const seria  = textChek.substring(0, 3)
     const number = textChek.substring(3, textChek.length)     

     
     const res = await fetch(`https://stats.datamark.by/api/label-card/?type_code=&series=${seria}&number=${number}`);
     const json = await res.json();

    if (json.IsFound  === '1') {
        const mes = 'Результат по коду ' + textChek + ':\n' 
               + json.Tp + '\n' + json.In + '\n' 
               + 'Поставщик: ' + json.Rel.WSRel.Name
               + ', УНП: ' + json.Rel.WSRel.UNP + '\n'          
               + 'Дата выдачи: ' + json.Rel.WSRel.Date   
            savehistory(chatid, 'search ' + textChek, 'info found')             
            bot.sendMessage(chatid, mes)                   
    }
     
    else {
         savehistory(chatid, 'search ' + textChek, 'info not found')  
         bot.sendMessage(chatid, `Информация по запросу <b>${textChek}</b> не найдена! Убедитесь что вы использовали английские буквы в серии!`, {parse_mode: 'HTML', disable_web_page_preview : true})            }
     
    checkRequest = false

}


const start = () => {

  bot.setMyCommands([
    {command: '/start',     description: 'Запуск бота'},
    {command: '/check',     description: 'Проверка марки'},    
    {command: '/official',  description: 'Официальные поставщики масла'},   
    {command: '/promocodes',description: 'Промокоды каршеринг'},        
    {command: '/info',      description: 'О боте'},    
  ])

  bot.on("message", async msg => {
  
    const chatid     = msg.chat.id
    const first_name = msg.chat.first_name   
    const text       = msg.text
    const message_id = msg.message_id
     
    if (msg.photo) {
       
      
       const fileId = msg.photo[msg.photo.length - 1].file_id;
       
       if (!fs.existsSync('./images')){fs.mkdirSync('./images')}

      // await bot.sendMessage(chatid, 'Фото...')      
        
       let photoLink =''
       await bot.getFileLink(fileId)
         .then(link=> {
             photoLink = link
             axios({method: "get", url: link, responseType: "stream"})
                 .then(response =>
                  response.data.pipe(fs.createWriteStream("./images/"+fileId))
          )
          }
          ); 
          

        
            savehistory(chatid, 'photo', fileId) 
                          
            //   await bot.sendMessage(chatid, 'Фото 2...')  
                   
            const sslCreds = await getApiKeyCredentials();
            // Creates a client
            const client = new vision.ImageAnnotatorClient({sslCreds});

           // await bot.sendMessage(chatid, 'Фото 3...')  

            // ТУТ ПРОСТО В КАЧЕСТВЕ ЗАДЕРЖКИ ДЕЛАЕМ
           const [result2] = await client.textDetection(photoLink);
           const labels2 = result2.textAnnotations;
           labels2.forEach(text => console.log(text.description));  
            
                 
                    await bot.sendMessage(chatid, 'Выполняется распознавание фото...')   
                
                    try {                   
                    // Performs label detection on the image file            
                    const [result] = await client.textDetection("./images/"+fileId);
                    const labels = result.textAnnotations;
                    
                    //labels.forEach(text => console.log(text.description));
        
                    if (labels.length) {
                        
                        // console.log(labels[0].description)
                        //console.log(typeof labels[0].description)
                        const array = labels[0].description.match(/[a-zA-Z]{3}\d{3,15}/g)
                        //console.log(array)
                            if (array) {
                                  array.forEach((el) => runcheck(chatid, el))
                            }
                            
                            else {
                                await bot.sendMessage(chatid, 'Не обнаужили данных об акцизных марках на фото!')
                                //console.log('Результат распознавания: ')
                                //labels.forEach((el) => console.log(el.description))
                            }
                      }
                      
                    } catch (err) {
                        await bot.sendMessage(chatid, '- ' + err.message)    
                        console.log('- ' + err.message) 
                     }   
                      
 
 
       //bot.sendMessage(
       //   chatid,
       //   `Получили ваше изображение! ${fileId} ${message_id} ${first_name} ${chatid}`
       //  );       
       return;              
    }    
    
  
    if (text === '/start') {
       await bot.sendMessage(chatid, `Добро пожаловать в бот проверки акцизных марок! Выберите в меню нужную операцию`, {parse_mode: 'HTML', disable_web_page_preview : true})
       await bot.sendSticker(chatid, 'https://tlgrm.ru/_/stickers/3b5/c3c/3b5c3c9e-3bc4-41c2-9cba-f288f3a4d5bb/4.webp')
       savehistory(chatid, text, '')
       return
    }
    if (text === '/check') {
       checkRequest = true
       check(chatid)
       savehistory(chatid, text, '')       
       return
    }   
     if (text === '/official') {
       official(chatid)
       savehistory(chatid, text, '')  
       return
    }
     if (text === '/promocodes') {
       promocodes(chatid)
       savehistory(chatid, text, '')  
       return
    }   
    if (text === '/info') {
       bot.sendMessage(chatid, `     Бот по проверке акцизных марок (моторного масла и прочих)\n Ваши пожелания, замечания, информацию об ошибках и т.д. пишите прямо в бот или высылайте по адресу: E-mail: <b>OilRbBot@gmail.com</b>\n Донаты и благодарности принимаются через <b>BTC кошелек 18i3LhkVfmEJ8MvaeQXMTjPbQxAPtXKJ2Z</b>`, {parse_mode: 'HTML', disable_web_page_preview : true})
       savehistory(chatid, text, '')         
       return
    }  
    

     if (checkRequest) {
     
          runcheck(chatid, text)

       }
       
       else {
       
       
               const array = text.match(/[a-zA-Z]{3}\d{3,15}/g)
                //console.log(array)
               if (array) {
                   array.forEach((el) => runcheck(chatid, el))
               }  
       
               else {
                savehistory(chatid, 'text', text)  
                bot.sendMessage(chatid, `Спасибо за ваш комментарий!`)  
                }    
       }
      
    // тут надо записать в базу

    
  })
  
    bot.on('callback_query', async msg => {
    
     const dataMsg = msg.data
     const chatid  = msg.from.id
        
     try { 
        
        await bot.answerCallbackQuery(msg.id,  {text: "You pressed " + dataMsg, show_alert: false})
               
        
     }
     catch (err) {console.log(err.message)} 
            
  })
}

start()

// *****************************************
// *****************************************
// *****************************************


function transliterate(word){
  const a = {"К":"K","Е":"E","к":"k","е":"e","В":"B","А":"А","Р":"P","О":"O","в":"b","а":"a","р":"p","о":"o","С":"C","М":"M","Т":"T","с":"c","м":"m","т":"t"};
  return word.split('').map((char) => a[char] || char).join("");
}


// ПРОВЕРКА АКЦИЗНЫХ МАРОК
const check = async (chatid) => {
     const Сообщ_ = `Введите серию (английскими буквами) и номер акцизной марки без пробела, например:\n<b>CAA123456789</b>\nИли загрузите фотографию акцизной марки`
     bot.sendMessage(chatid, Сообщ_, {parse_mode: 'HTML', disable_web_page_preview : true})
//.then(mesageSent => lastKeyboards[chatid+'_prompt'].push(mesageSent.message_id))
}

// ПРОМОКОДЫ КАРШЕРИНГА
const promocodes = async (chatid) => {

const Сообщ_ = 
`<b>Промокоды каршерингов Минска:</b>

<a href="https://multik.by/">MULTIMOTORS</a>
<b>TVTV0Z</b>

<a href="https://hello.by/">HELLO</a>
<b>FHE67Z</b>

<a href="https://any-time.by/">ANYTIME</a>
<b>LAWIQE</b>`

bot.sendMessage(chatid, Сообщ_, {parse_mode: 'HTML', disable_web_page_preview : true})
//.then(mesageSent => lastKeyboards[chatid+'_prompt'].push(mesageSent.message_id))
}


// ОФИЦИАЛЬНЫЕ ПОСТАВЩИКИ МАСЛА
const official = async (chatid) => {

const Сообщ_ = 
`<b>    Официальные импортёры масла в РБ на 01.02.2019:</b>

Для добавления в список отправьте на адрес <b>OilRbBot@Gmail.com</b> подтверждающие документы либо ссылку на сайт производителя, где ваша компания указана в качестве официального импортера!
  		
<b>Моторные масла TOTAL, ELF:</b>
<a href="https://www.total-lub.ru/find_our_products">Источник: https://www.total-lub.ru/find_our_products</a>
<a href="http://total.by">- УП "ПС Авто Групп" (ЗАО "Комплексснаб")</a>
<a href="http://www.beloilgroup.by">- ООО "БелОилГрупп"</a>
<a href="http://armtek.by">- ООО "Еврозапчасть" (Армтек)</a>
		
<b>Моторные масла CASTROL:</b>
<a href="https://www.castrol.com/ru_ru/russia/about-us/locations.html">Источник: https://www.castrol.com/ru_ru/russia/about-us/locations.html</a>
<a href="http://www.autotm.by">- СООО "АвтоТракМоторс"</a>
<a href="http://www.atlantmnord.by">- ООО Атлант-М Норд</a>
<a href="http://www.l-auto.by">- ООО "Л-Авто"</a>
		
<b>Моторные масла ЛУКОЙЛ:</b>
<a href="http://www.lukoil-lubricants.ru/ru/Dealers/InternationalDistributionNetwork/Belarus">Источник: http://www.lukoil-lubricants.ru/ru/Dealers/InternationalDistributionNetwork/Belarus</a>
<a href="http://www.lukoil.by">- ИООО "Лукойл-Белоруссия"</a>
<a href="http://www.viland.by">- ООО "Виланд"</a>
<a href="http://armtek.by">- ООО "Еврозапчасть" (Армтек)</a>
<a href="http://grandoil.by">- ООО "Грандойл"</a>
<a href="http://www.vitoil.by">- ООО "Дом Авто"</a>
<a href="http://gromin-masla.by">- ОДО "Громин"</a>
		
<b>Моторные масла GENERAL MOTORS:</b>
<a href="https://auto.onliner.by/2019/02/01/maslo-6">Источник: По данным статьи Онлайнера</a>
<a href="http://www.multimotors.by">- ИУП "Мультимоторс"</a>
<a href="http://armtek.by">- ООО "Еврозапчасть" (Армтек)</a>
		
<b>Моторные масла MOBIL:</b>
<a href="https://mobildelvac.ru/ru/distributor-locator">Источник: https://mobildelvac.ru/ru/distributor-locator</a>
<a href="http://www.gammaplus.by/">- ОДО "Гамма плюс"</a>
		
<b>Моторные масла MOTUL:</b>
<a href="https://www.motul.com/by/ru/information/contact_us">Источник: https://www.motul.com/by/ru</a>
<a href="http://www.monlibon.by">- ООО "Монлибон"</a>
<a href="http://www.aprila.by">- ООО "Априла"</a>
		
<b>Моторные масла MITSUBISHI:</b>
<a href="https://www.mitsubishi-motors.ru/for-byers/dealers/%D0%9C%D0%B8%D0%BD%D1%81%D0%BA/">Источник: https://www.mitsubishi-motors.ru/for-byers/dealers</a>
<a href="https://www.mitsubishi-motors.by/">- ООО "Редмоторс"</a>
		
<b>Моторные масла SHELL:</b>
<a href="https://www.shell.com.ru/%d0%a8%d0%b5%d0%bb%d0%bb-%d0%b4%d0%bb%d1%8f-%d0%b1%d0%b8%d0%b7%d0%bd%d0%b5%d1%81%d0%b0/%d0%a1%d0%bc%d0%b0%d0%b7%d0%be%d1%87%d0%bd%d1%8b%d0%b5-%d0%bc%d0%b0%d1%82%d0%b5%d1%80%d0%b8%d0%b0%d0%bb%d1%8b-%d0%b4%d0%bb%d1%8f-%d0%b1%d0%b8%d0%b7%d0%bd%d0%b5%d1%81%d0%b0/%d0%9a%d0%be%d0%bd%d1%82%d0%b0%d0%ba%d1%82%d1%8b-Shell-Lubricants/%d0%94%d0%b8%d1%81%d1%82%d1%80%d0%b8%d0%b1%d1%8c%d1%8e%d1%82%d0%be%d1%80%d1%8b-%d0%a8%d0%b5%d0%bb%d0%bb.html">Источник: https://www.shell.com.ru</a>
<a href="http://oil-motor.by">- ООО "Ойл Мотор"</a>
		
<b>Моторные масла ALPINE:</b>
<a href="https://www.mitan-daten.de/index.php/ru/export-ru">Источник: https://www.mitan-daten.de/index.php/ru/export-ru</a>
<a href="https://alpineoil.by">- ОДО "Центр инноваций"</a>
		
<b>Моторные масла COMMA:</b>
<a href="https://ru.commaoil.com/stockists/search/international/365">Источник: https://ru.commaoil.com/stockists/search/international/365</a>
<a href="http://armtek.by">- ООО "Еврозапчасть" (Армтек)</a>
<a href="http://www.sviat.by/">- ООО "СВИАТ"</a>
		
<b>Моторные масла ГАЗПРОМНЕФТЬ:</b>
<a href="http://www.gazpromneft-oil.com/clients/gpn.nsf/all/m06-02s?opendocument%26stype=EA2D34B5D49D5128C225793C001A63FA">Источник: www.gazpromneft-oil.com/clients</a>
<a href="http://www.autospace.by">- ООО "Автоспейс"</a>
<a href="https://1ak.by">- ООО "Белинвестторг"</a>
<a href="http://www.sivanabel.by">- ООО "СИВАНАБЕЛ"</a>
<a href="http://bonixauto.adz.by">- ООО "Боникс Авто Плюс"</a>
<a href="http://www.l-auto.by">- ООО "Л-Авто"</a>
		
<b>Моторные масла SWD Rheinol:</b>
<a href="https://www.swdrheinol.com/en/portfolio/weissrusslund">Источник: https://www.swdrheinol.com/en/portfolio/weissrusslund</a>
<a href="http://www.AutoVision.by">- ООО "Авто Вижен"</a>
<a href="https://www.dizagio.by">- ООО "Дизажио"</a>
		
<b>Моторные масла WOLF:</b>
<a href="https://www.wolflubes.com/ru_ru/where-to-buy/default.aspx">Источник: https://www.wolflubes.com/ru_ru/where-to-buy/default.aspx</a>
<a href="http://www.l-auto.by">- ООО "Л-Авто"</a>
`

bot.sendMessage(chatid, Сообщ_, {parse_mode: 'HTML', disable_web_page_preview : true})
//.then(mesageSent => lastKeyboards[chatid+'_prompt'].push(mesageSent.message_id))
}
