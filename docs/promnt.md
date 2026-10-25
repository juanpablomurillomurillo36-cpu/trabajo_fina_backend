Vamos a crear una aplicación backend con arquitectura API REST. La aplicación manejara una discoteca y debe cumplir con los requerimientos  que estan en C:\Users\venus\Desktop\TRABAJO-FINAL-SENA\Backend-proyecto discoteca\parametrization> 

El stack tecnológico para el backend es Node.js, Express.js y MySQL. El objetivo de esta sección es desarrollar el  backend web con JavaScript  por lo que es imprescindible que documentes todos los pasos en un archivo "reamid.md", Para cada cambio o paso implementado, escribirás el comando en el archivo "reamid.md".

La estructura de carpetas para este proyecto será:

persona-api/
├── config/
├── controllers/
├── middleware/
├── models/
├── routes/
├── services/
├── utils/           # opcional pero recomendado
├── .env
├── .gitignore
├── index.js (o app.js)
└── package.json

config: almacenará la clase de conexión a la base de datos "database.js", el archivo de configuración "express.js" y las variables de entorno cargadas con dotenv.

controllers: maneja la lógica de entrada y salida de cada endpoint.

models: define las entidades del modelo de datos para la aplicación con los atributos privados, constructor, setters y getters.

routes: define los endpoints de la API, define la estructura de las peticiones y respuestas y el mapeo hacia los controladores.

services: encapsula la lógica de negocio. Tomará las entidades de los modelos, creará los objetos y posteriormente implementará las operaciones de actualización de la base de datos. En services se tomará las clases que se encuentran el la carpeta models, se crearán instancias de los objetos y se realizarán las operaciones solicitadas en los ssr (las CRUD,etc) sobre la base de datos utilizando la encapsulación orientada a objetos, haciendo uso de los atributos de la clase mediante sus getters y setters. En services también se utilizarán las funciones o clases de la carpeta utils para las funciones de validación y formateo.

middleware: funciones y clases para el manejo de errores.

utils: carpeta con todas las funciones y clases para formatear fechas, los diferentes tipos de datos, métodos de cifrado, constantes, mensajes de error y validadores personalizados.

En la carpeta raíz estarán "index.js" o "app.js" como punto de entrada, el archivo ".env", el archivo ".gitignore" y el archivo "package.json".

la ruta que debe seguir una peticion hecha desde el frontend es routes->controllers->service->models->DB

El ejemplo de como realizar el backend esta en C:\Users\venus\Desktop\TrabajosSena\repositori_example_backend\personal_management_fullstack\persona-ap

lee el ejemplo y los ssr,la carpeta models ya cuenta con todas las clases la cuales se sacaron de la base de datos, por el momento solo realizara usuarioRoute-usuariController-usuarioService y rolRoute-rolController-rolService

los metodos get pust past put delete de usuario y cliente sera probados en postman


Si no cubrí algo aquí, pregúntame cualquier cosa que quieras, escribe todas las instrucciones, comandos y códigos paso a paso, y que también escribe comentarios en el código, todo esto en español latinoamericano. 