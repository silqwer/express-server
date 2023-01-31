'use strict'

const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require("helmet");
const bodyParser = require('body-parser');
const serveStatic = require('serve-static')


const http = require('http');

class Server extends http.Server {
  constructor(){
    const app = express();
    super(app);

    this.app.static = serveStatic;

    this.config = config;
    this.app = app;
    this.currentConns = new Set();
    this.busy = new WeakSet(); // 서버가 중지하기 전에 접속 
    this.stopping = false;
  }

  async start() {
    this.app.use(helmet());
    
    this.app.use((req, res, next) => {
      this.busy.add(req.socket)
      res.on('finish', ()=> {
        if(this.stopping){
          req.socket.end();
        }
        this.busy.delete(req.socket);
      })
      next();
    });

    this.app.use(cookieParser());

    this.app.get('/_health', (req, res) => {
      res.sendStatus(200);
    });

    this.app.use((err, req, res, next) => {
      res.status(500).send(generateApiError('Api::Error'))
    });

    this.on('connection', c => {
      this.currentConns.add(c);
      c.on('close', ()=> this.currentConns.delete(c));
    })

    return this;
  }

  shutdown() {
    if(this.stopping){
      return 
    }

    this.stopping = true;
    this.close(()=> {
      process.exit(0);
    })
    
    this.setTimeout(() => {
      console.error('비정상적인 종료(강제 종료합니다.)');
      process.exit(1)
    }, this.config.shutdownTimeout).unref();
  }
}

const init  = async (config = {}) => {
  const server = new Server(config);
  return server.start(); 
}