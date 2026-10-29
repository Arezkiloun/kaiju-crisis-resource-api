import {
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";

import { Server } from "socket.io";

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway {
  @WebSocketServer()
  server!: Server;

  emitResourceUpdated(payload: unknown) {
    this.server.emit(
      "resource.updated",
      payload,
    );
  }

  emitTransferUpdated(payload: unknown) {
    this.server.emit(
      "transfer.updated",
      payload,
    );
  }

  emitDisasterLevelChanged(payload: unknown) {
    this.server.emit(
      "disaster.levelChanged",
      payload,
    );
  }
}
