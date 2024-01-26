//Llamamos a express
const express = require('express')
const fs = require('fs')
const path = require('path')
const app = express()

//Llamamos a dotenv
const dotenv = require('dotenv')
dotenv.config({path:'./env/.env'})

let logged;
let usuarioActual;

app.use('/css', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/css')))
app.use('/js', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/js')))
app.use('/js', express.static(path.join(__dirname, 'node_modules/jquery/dist')))

//Urlencoded para capturar los datos del formulario
app.use(express.urlencoded({extended:false}))
app.use(express.json())

//Directorio public
app.use('/resources', express.static('public'))
app.use('/resources', express.static(__dirname + '/public'))

//Motor de plantillas
//app.set('views', 'views');
app.set('view engine', 'ejs');

const bcryptjs = require('bcryptjs')

const session = require('express-session')
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized:true
}));

//Modulo de conexion
const connection = require('./database/db');

//paxina login
app.get('/login', (req, res) => {
    res.render('login')
})

//paxina rexistro
app.get('/register', (req, res) => {
    res.render('register')
})

//paxina info
app.get('/info', (req,res) => {
    if(logged){
        res.render('info', {
            login: true,
            name: req.session.name
        });
    } else {
        res.render('info', {
            login: false
        })
    }
})

//paxina imaxes
app.get('/imaxes', (req, res) => {
    if(logged){
        res.render('imaxes', {
            login: true,
            name: req.session.name
        });
    } else {
        res.render('imaxes', {
            login: false
        })
    }
})

//paxina comentarios
app.get('/comentarios', (req, res) => {

    let numCom, textos = [], autores = [], id = [];

    //consulta select con orde descendente para que os novos comentarios aparezan arriba
    connection.query('select * from Comentarios order by Fecha desc', async(error, results)=>{
        if(error){
            throw error;
        } else {

            numCom = results.length;

            //gardo os datos en arrays
            for (const txt of results){
                textos.push(txt.Texto);
                autores.push(txt.Usuario);
                id.push(txt.Id);
            }

            //gardo os arrays de datos na sesión actual para recollelos máis tarde
            req.session.numCom = numCom;
            req.session.textos = textos;
            req.session.autores = autores;
            req.session.id = id;

            //recargo comentarios
            res.render('comentarios', {
                login: true,
                name: req.session.name,
                usuario: usuarioActual,
                idComentario: id,
                numComentarios: numCom,
                autor: autores,
                texto: textos
            });
        }
    })
    
})

//paxina publicacions
app.get('/publicacions', (req, res) => {

    let numPubli, textos = [], imaxes = [], id = [], fecha = [];

    connection.query('select *, DATE_FORMAT(Fecha, "%H:%i - %d/%m/%Y") as NewFecha from Publicacions order by Fecha desc', async(error, results)=>{
        if(error){
            throw error;
        } else {

            numPubli = results.length;

            for (const txt of results){
                textos.push(txt.Texto);
                fecha.push(txt.NewFecha);
                imaxes.push(txt.Imagen);
                id.push(txt.Id);
            }

            req.session.numPubli = numPubli;
            req.session.textosPubli = textos;
            req.session.imaxes = imaxes;
            req.session.idPubli = id;
            req.session.fechas = fecha;


            res.render('publicacions', {
                login: true,
                name: req.session.name,
                usuario: usuarioActual,
                idPublicacion: id,
                numPublicacions: numPubli,
                fecha: fecha,
                imaxe: imaxes,
                texto: textos
            });
        }
    })

})

//Escribir unha nova publicación
app.post('/publicacion', async (req,res)=>{
    const imagen = req.body.imagen;
    const texto = req.body.text;

    connection.query('insert into Publicacions set ?', {Texto: texto, Imagen: imagen}, async(error, results)=>{
        if(error){
            console.log(error);
        } else {

            //recargo a paxina enviando datos para mostrar a mensaxe na pantalla
            res.render('publicacions', {
                login:true,
                name: req.session.name,
                usuario: usuarioActual,
                numPublicacions: 0,
                imaxe: 0,
                alert:true,
                alertTitle: "Feito",
                alertMessage: "Publicación engadida",
                alertIcon: "success",
                showConfirmButton: true,
                timer: false,
                ruta: 'publicacions'
            })
        }
    })
})

//--Registro--
app.post('/register', async (req,res)=>{
    const user = req.body.user;
    const name = req.body.name;
    const pass = req.body.pass;
    let passwordHash = await bcryptjs.hash(pass,8);

    //reconocer si ya existe ese nombre de usuario
    const selectUserName = connection.query('select Usuario from Usuarios where Usuario = ?', [user], async(err, row)=>{
        if(row.length == 0){
            connection.query('insert into Usuarios set ?', {Nombre:name, Contraseña:passwordHash, Usuario:user}, async(error, results)=>{
                if(error){
                    console.log(error);
                } else {
                    //res.render('/')
                    res.render('register', {
                        alert: true,
                        alertTitle: "Registro",
                        alertMessage: "Usuario registrado",
                        alertIcon: 'success',
                        showConfirmButton:false,
                        timer:1500,
                        ruta:''
                    })
                }
                
            })
        } else {
            res.render('register', {
                alert:true,
                alertTitle: "Error",
                alertMessage: "Ese nombre de usuario ya existe",
                alertIcon: "error",
                showConfirmButton: true,
                timer: false,
                ruta: 'register'
            })
            
        }
    })

    
})

//Autenticación
app.post('/auth', async (req,res)=>{
    usuarioActual = req.body.user;
    const user = req.body.user;
    const pass = req.body.pass;
    let passwordHash = await bcryptjs.hash(pass, 8);
    if(user && pass){
        connection.query('select * from Usuarios where Usuario = ?', [user], async (error, results)=>{
                      
            if(results.length == 0 || !(await bcryptjs.compare(pass, results[0].Contraseña))){
                req.session.loggedin = false;
                res.render('login', {
                    alert:true,
                    alertTitle: "Error",
                    alertMessage: "Usuario ou contrasinal incorrectas",
                    alertIcon: "error",
                    showConfirmButton: true,
                    timer: false,
                    ruta: 'login'
                })

            } else {
                req.session.loggedin = true;
                req.session.name = results[0].Nombre
                logged = true;
                res.render('login', {
                    alert:true,
                    alertTitle: "Conexion feita",
                    alertMessage: "Usuario correcto",
                    alertIcon: "success",
                    showConfirmButton: false,
                    timer: 1500,
                    ruta: ''
                })
            }
        })
    }

})

//Añadir comentario a la base de datos
app.post('/comentario', async (req,res)=>{
    const texto = req.body.text;
        connection.query('insert into Comentarios set ?', {Usuario: usuarioActual, Texto: texto}, async(error, results)=>{
            if(error){
                console.log(error);
            } else {
                res.render('comentarios', {
                    login: true,
                    name: req.session.name,
                    usuario: usuarioActual,
                    numComentarios: req.session.numCom,
                    autor: req.session.autores,
                    texto: req.session.textos,
                    idComentario: req.session.id,
                    alert:true,
                    alertTitle: "Feito",
                    alertMessage: "Gracias por agregar o teu comentario",
                    alertIcon: "success",
                    showConfirmButton: true,
                    timer: false,
                    ruta: 'comentarios'
                })
            }
            
        })
})

//funcion de borrado de comentarios
app.post('/borrar', async (req, res)=>{
    const id = req.body.idCom;
    connection.query('delete from Comentarios where ?', {Id: id}, async(error, results)=>{
        if(error){
            console.log(error);
        } else {
            res.render('comentarios', {
                login: true,
                name: req.session.name,
                usuario: usuarioActual,
                numComentarios: req.session.numCom,
                autor: req.session.autores,
                texto: req.session.textos,
                idComentario: req.session.id,
                alert:true,
                alertTitle: "Borrado",
                alertMessage: "Comentario borrado con éxito",
                alertIcon: "success",
                showConfirmButton: true,
                timer: false,
                ruta: 'comentarios'
            })
        }
        
    })
})

//función de borrado de publicacións
app.post('/borrarPubli', async (req, res)=>{
    const id = req.body.idPubli;
    connection.query('delete from Publicacions where ?', {Id: id}, async(error, results)=>{
        if(error){
            console.log(error);
        } else {
            res.render('publicacions', {
                login: true,
                name: req.session.name,
                usuario: usuarioActual,
                numPublicacions: req.session.numPubli,
                autor: req.session.autores,
                texto: req.session.textosPubli,
                idPublicacion: req.session.id,
                imaxe: req.session.imaxes,
                fecha: req.session.fechas,
                alert:true,
                alertTitle: "Borrado",
                alertMessage: "Publicación borrada con éxito",
                alertIcon: "success",
                showConfirmButton: true,
                timer: false,
                ruta: 'publicacions'
            })
        }
        
    })
})

//Autenticación en páginas
app.get('/', (req,res)=>{
    if(logged){
        res.render('index', {
            login: true,
            name: req.session.name
        });
    } else {
        res.render('index', {
            login: false
        })
    }
})

//Logout
app.get('/logout', (req,res)=>{
    req.session.destroy(()=>{
        logged = false;
        res.redirect('/');
    })
})

app.listen(3000, (req, res) => {
    console.log('Servidor funcionando')
})