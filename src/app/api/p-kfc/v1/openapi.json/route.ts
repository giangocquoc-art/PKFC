import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const schema = {
    openapi: "3.1.0",
    info: {
      title: "P-KFC API",
      description: "StoreOps Decision Agent for KFC Ho Chi Minh City shift managers. External HTTP access gateway. Independent hackathon demo. Not an official KFC product.",
      version: "1.0.0"
    },
    servers: [
      {
        url: "/api/p-kfc/v1",
        description: "Local or relative API path"
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Authorization: Bearer <P_KFC_API_KEY>"
        },
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-p-kfc-api-key",
          description: "x-p-kfc-api-key: <P_KFC_API_KEY>"
        }
      }
    },
    security: [
      { BearerAuth: [] },
      { ApiKeyAuth: [] }
    ],
    paths: {
      "/profile": {
        get: {
          summary: "Get API Profile",
          description: "Returns general info and disclaimer for the P-KFC API.",
          responses: {
            "200": {
              description: "API profile response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      name: { type: "string" },
                      agent: { type: "string" },
                      version: { type: "string" },
                      description: { type: "string" },
                      capabilities: {
                        type: "array",
                        items: { type: "string" }
                      },
                      disclaimer: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/runs": {
        post: {
          summary: "Run StoreOps Pipeline",
          description: "Triggers the agent pipeline for a store, creating a run and generating planning data.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["storeId"],
                  properties: {
                    storeId: { type: "string", description: "ID of the target store" },
                    language: { type: "string", enum: ["vi", "en"], default: "vi" }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Pipeline triggered successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      runId: { type: "string" },
                      storeName: { type: "string" },
                      summary: { type: "string" },
                      actions: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            type: { type: "string" },
                            recommendation: { type: "string" }
                          }
                        }
                      },
                      approvalRequests: { type: "array", items: { type: "object" } },
                      evidence: { type: "array", items: { type: "string" } },
                      dataSourceMode: {
                        type: "object",
                        properties: {
                          weather: { type: "string" },
                          operations: { type: "string" },
                          inventory: { type: "string" },
                          staffing: { type: "string" }
                        }
                      },
                      disclaimer: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/runs/{runId}": {
        get: {
          summary: "Get Past Run Detail",
          description: "Retrieves details of a past agent execution by runId.",
          parameters: [
            {
              name: "runId",
              in: "path",
              required: true,
              schema: { type: "string" }
            }
          ],
          responses: {
            "200": {
              description: "Run fetched successfully",
              content: {
                "application/json": {
                  schema: { type: "object" }
                }
              }
            },
            "404": {
              description: "Run not found"
            }
          }
        }
      },
      "/chat": {
        post: {
          summary: "Grounded Chat with Run Context",
          description: "Asks a question grounded in the specified store run context.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["runId", "message"],
                  properties: {
                    runId: { type: "string" },
                    message: { type: "string" },
                    language: { type: "string", enum: ["vi", "en"], default: "vi" }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Chat response received",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      question: { type: "string" },
                      answer: { type: "string" },
                      groundedInRun: { type: "boolean" },
                      runId: { type: "string" },
                      modelUsed: { type: "string" },
                      providerMode: { type: "string" },
                      evidenceUsed: { type: "array", items: { type: "string" } },
                      dataSourceMode: { type: "object" },
                      disclaimer: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/chat/completions": {
        post: {
          summary: "OpenAI-Compatible Chat Completions",
          description: "OpenAI-compatible chat completion endpoint grounded in a specific or latest run.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["messages"],
                  properties: {
                    messages: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["role", "content"],
                        properties: {
                          role: { type: "string" },
                          content: { type: "string" }
                        }
                      }
                    },
                    model: { type: "string" },
                    metadata: {
                      type: "object",
                      properties: {
                        storeId: { type: "string" },
                        runId: { type: "string" },
                        language: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "OpenAI chat completion response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      object: { type: "string" },
                      created: { type: "integer" },
                      model: { type: "string" },
                      choices: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            index: { type: "integer" },
                            message: {
                              type: "object",
                              properties: {
                                role: { type: "string" },
                                content: { type: "string" }
                              }
                            },
                            finish_reason: { type: "string" }
                          }
                        }
                      },
                      metadata: {
                        type: "object",
                        properties: {
                          runId: { type: "string" },
                          dataSourceMode: { type: "object" },
                          approvalRequired: { type: "boolean" },
                          disclaimer: { type: "string" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/briefings/export": {
        post: {
          summary: "Export Shift Briefing Markdown",
          description: "Generates the shift briefing in Markdown format for the specified runId.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["runId"],
                  properties: {
                    runId: { type: "string" },
                    language: { type: "string", default: "vi" }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Markdown briefing generated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      markdown: { type: "string" },
                      filename: { type: "string" },
                      disclaimer: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  };

  return NextResponse.json(schema);
}
