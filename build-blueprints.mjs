import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const CONN = {
  ai: 12349170,
  scrappa: 12349301,
  hunter: 12349376,
  microsoft: 12349388,
  telegram: 12349438
};

const BASE = 'appREPLACE_BASE_ID';
const T = {
  productos: 'tblREPLACE_PRODUCTOS',
  leads: 'tblREPLACE_LEADS',
  outbox: 'tblREPLACE_OUTBOX',
  conversaciones: 'tblREPLACE_CONVERSACIONES',
  contenido: 'tblREPLACE_CONTENIDO',
  config: 'tblREPLACE_CONFIG',
  metricas: 'tblREPLACE_METRICAS',
  aprendizajes: 'tblREPLACE_APRENDIZAJES'
};
const CHAT_ID = '5144879357';

const aiConnectionParam = {
  label: 'Connection',
  name: 'makeConnectionId',
  type: 'account:ai-provider,openai-gpt-3,anthropic-claude,gemini-ai-q9zyjp,ai-agent-foundry-openai,ai-agent-foundry-non-openai,mistral-ai,cohere,groq,ai-agent-xai,amazon-bedrock,ai-agent-openai-compatible',
  required: true
};

const airtableConnectionParam = {
  name: '__IMTCONN__',
  type: 'account:airtable3,airtable2',
  label: 'Connection',
  required: true
};

const modelEnum = [
  'small', 'medium', 'large',
  'gpt-6.1-sol', 'gpt-6.1-terra', 'gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna',
  'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini',
  'gpt-5.2', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano',
  'global.anthropic.claude-fable-5-1', 'global.anthropic.claude-fable-5',
  'global.anthropic.claude-sonnet-5-5', 'global.anthropic.claude-sonnet-5',
  'global.anthropic.claude-opus-5-5', 'global.anthropic.claude-opus-5',
  'global.anthropic.claude-opus-4-8', 'global.anthropic.claude-opus-4-7',
  'global.anthropic.claude-sonnet-4-6', 'global.anthropic.claude-opus-4-6-v1',
  'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'global.anthropic.claude-haiku-5-5', 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
  'global.anthropic.claude-opus-4-5-20251101-v1:0'
];

const scenarioMetadata = (sequential = false) => ({
  instant: false,
  version: 1,
  scenario: {
    roundtrips: 1,
    maxErrors: 3,
    autoCommit: true,
    autoCommitTriggerLast: true,
    sequential,
    slots: null,
    confidential: false,
    dataloss: false,
    dlq: false,
    freshVariables: false
  },
  designer: { orphans: [] },
  zone: 'us2.make.com',
  notes: []
});

function designer(x, y, name) {
  return name ? { x, y, name } : { x, y };
}

function agentModule({ id, prompt, message, tools, name, x = 0, y = 0 }) {
  return {
    id,
    module: 'ai-local-agent:RunLocalAIAgent',
    version: 0,
    parameters: { makeConnectionId: CONN.ai },
    mapper: {
      systemPrompt: prompt,
      message,
      outputType: 'text',
      defaultModel: 'large',
      tokenLimit: 100,
      promptCaching: 'none',
      fallbackEnabled: false,
      modelConfig: {
        recursionLimit: 100,
        iterationsFromHistoryCount: 10,
        timeout: 600,
        aiCompactionEnabled: true
      }
    },
    metadata: {
      designer: designer(x, y, name),
      restore: {
        parameters: {
          makeConnectionId: { label: "Make's AI Provider (default)" }
        },
        expect: {
          defaultModel: { mode: 'chose', label: 'Large' },
          outputType: { mode: 'chose', label: 'Text' }
        }
      },
      parameters: [aiConnectionParam],
      expect: [
        {
          name: 'defaultModel',
          type: 'select',
          label: 'Model',
          required: true,
          mappable: true,
          dynamic: true,
          grouped: true,
          isolated: true,
          isContext: true,
          default: 'large',
          validate: { enum: modelEnum }
        },
        {
          name: 'tokenLimit',
          type: 'number',
          label: 'Maximum output length (%)',
          advanced: true,
          required: false,
          default: 100,
          validate: { min: 20, max: 100 }
        },
        {
          name: 'promptCaching',
          type: 'select',
          label: 'Prompt caching',
          required: false,
          advanced: true,
          default: 'none',
          validate: { enum: ['none'] }
        },
        {
          name: 'fallbackEnabled',
          label: 'Enable fallback connection',
          type: 'boolean',
          required: true,
          default: false,
          advanced: false
        },
        {
          name: 'systemPrompt',
          label: 'Instructions',
          type: 'text',
          placeholder: 'You are an agent specialized in...',
          required: false,
          advanced: false,
          editable: true
        },
        {
          name: 'message',
          label: 'Input',
          type: 'text',
          placeholder: 'Tasks or information for the agent to process...',
          required: true,
          editable: true
        },
        {
          name: 'files',
          label: 'Input files',
          type: 'array',
          labels: { add: 'Add file', item: 'File' },
          mappable: true,
          spec: [
            { name: 'fileName', type: 'filename', label: 'File name', semantic: 'file:name' },
            { name: 'data', type: 'buffer', label: 'Data', semantic: 'file:data' }
          ]
        },
        {
          name: 'threadId',
          label: 'Conversation ID',
          type: 'text',
          advanced: false,
          required: false,
          validate: { max: 256 }
        },
        {
          name: 'modelConfig',
          label: 'Model configuration',
          type: 'collection',
          advanced: true,
          spec: [
            { name: 'recursionLimit', label: 'Steps per agent call', type: 'number', advanced: true, required: false, default: 300 },
            { name: 'iterationsFromHistoryCount', label: 'Maximum conversation history', type: 'number', advanced: true, required: false, default: 10 },
            { name: 'timeout', label: 'Step timeout', type: 'number', required: false, advanced: true, validate: { min: 120, max: 600 } },
            { name: 'aiCompactionEnabled', label: 'Enable compaction', type: 'boolean', advanced: true, required: true, default: true }
          ]
        },
        {
          name: 'outputType',
          label: 'Response format',
          type: 'select',
          advanced: true,
          required: true,
          default: 'text',
          validate: { enum: ['text', 'make-schema', 'udt-schema'] }
        }
      ]
    },
    tools
  };
}

function airtableSearch({ id, x, y, name, table, tableLabel, fields, formula = '', maxRecords = 10, fieldTypes = {} }) {
  const interfaceFields = [
    { name: '__IMTLENGTH__', type: 'uinteger', label: 'Total number of bundles' },
    { name: '__IMTINDEX__', type: 'uinteger', label: 'Bundle order position' },
    { name: 'id', type: 'text', label: 'ID' },
    { name: 'createdTime', type: 'date', label: 'Created Time' },
    ...fields.map((f) => ({
      name: f,
      type: fieldTypes[f] || 'text',
      label: f
    }))
  ];

  return {
    id,
    module: 'airtable:ActionSearchRecords',
    version: 3,
    parameters: {},
    mapper: {
      base: BASE,
      table,
      fields,
      formula,
      maxRecords: String(maxRecords),
      useColumnId: false
    },
    metadata: {
      designer: designer(x, y, name),
      restore: {
        expect: {
          base: { mode: 'chose', label: 'Ventas Lamparas 3D' },
          table: { mode: 'chose', label: tableLabel },
          fields: { mode: 'chose', label: fields },
          formula: { mode: 'chose' },
          maxRecords: { mode: 'chose' },
          useColumnId: { mode: 'chose' }
        },
        parameters: {
          __IMTCONN__: { label: 'Airtable' }
        }
      },
      parameters: [airtableConnectionParam],
      expect: [
        { name: 'base', type: 'select', label: 'Base', required: true },
        { name: 'useColumnId', type: 'boolean', label: 'Use Column ID', required: true },
        { name: 'table', type: 'select', label: 'Table', required: true },
        { name: 'formula', type: 'text', label: 'Formula' },
        { name: 'maxRecords', type: 'integer', label: 'Limit' },
        {
          name: 'sort',
          spec: [
            { name: 'field', type: 'select', label: 'Field', dynamic: true, options: [] },
            {
              name: 'direction',
              type: 'select',
              label: 'Direction',
              options: [
                { label: 'Descending', value: 'desc' },
                { label: 'Ascending', value: 'asc' }
              ]
            }
          ],
          type: 'array',
          label: 'Sort'
        },
        { name: 'view', type: 'select', label: 'View' },
        { name: 'fields', type: 'select', label: 'Output Fields', multiple: true }
      ],
      interface: interfaceFields
    }
  };
}

function describeFields(spec) {
  return spec.map((f) => ({
    name: f.name,
    type: f.type || 'text',
    label: f.label || f.name,
    ...(f.type === 'select' ? { mode: 'edit' } : {})
  }));
}

function airtableCreate({ id, x, y, name, table, tableLabel, recordSpec, aiInstructions, fieldTypes = {} }) {
  const nested = {};
  for (const f of recordSpec) {
    const ai = aiInstructions[f.name];
    nested[f.name] = ai ? { extra: { aiHelp: ai.help, aiInstruction: ai.instruction } } : {};
  }

  return {
    id,
    module: 'airtable:ActionCreateRecord',
    version: 3,
    parameters: {},
    mapper: {
      base: BASE,
      table,
      record: '{{1.record}}',
      typecast: true,
      useColumnId: false
    },
    metadata: {
      designer: designer(x, y, name),
      restore: {
        expect: {
          base: { mode: 'chose', label: 'Ventas Lamparas 3D' },
          table: {
            mode: 'chose',
            label: tableLabel,
            nested: [
              { name: 'record', spec: describeFields(recordSpec), type: 'collection', label: 'Record' }
            ]
          },
          record: { nested },
          typecast: { mode: 'chose' },
          useColumnId: { mode: 'chose' }
        },
        parameters: {
          __IMTCONN__: { label: 'Airtable' }
        }
      },
      parameters: [airtableConnectionParam],
      expect: [
        { name: 'base', type: 'select', label: 'Base', required: true },
        { name: 'typecast', type: 'boolean', label: 'Smart links', required: true },
        { name: 'useColumnId', type: 'boolean', label: 'Use Column ID', required: true },
        { name: 'table', type: 'select', label: 'Table', required: true },
        { name: 'record', spec: describeFields(recordSpec), type: 'collection', label: 'Record' }
      ],
      interface: [
        { name: 'id', type: 'text', label: 'ID' },
        { name: 'createdTime', type: 'date', label: 'Created Time' },
        ...recordSpec.map((f) => ({
          name: f.name,
          type: fieldTypes[f.name] || 'text',
          label: f.label || f.name
        }))
      ]
    }
  };
}

function airtableUpdate({ id, x, y, name, table, tableLabel, recordSpec, aiInstructions, idInstruction, fieldTypes = {} }) {
  const nested = {};
  for (const f of recordSpec) {
    const ai = aiInstructions[f.name];
    nested[f.name] = ai ? { extra: { aiHelp: ai.help, aiInstruction: ai.instruction } } : {};
  }

  return {
    id,
    module: 'airtable:ActionUpdateRecords',
    version: 3,
    parameters: {},
    mapper: {
      id: '{{1.id}}',
      base: BASE,
      table,
      record: '{{1.record}}',
      typecast: true,
      useColumnId: false
    },
    metadata: {
      designer: designer(x, y, name),
      restore: {
        expect: {
          base: { mode: 'chose', label: 'Ventas Lamparas 3D' },
          table: { mode: 'chose', label: tableLabel },
          record: { nested },
          typecast: { mode: 'chose' },
          useColumnId: { mode: 'chose' },
          id: { extra: { aiHelp: 'Record ID', aiInstruction: idInstruction } }
        },
        parameters: {
          __IMTCONN__: { label: 'Airtable' }
        }
      },
      parameters: [airtableConnectionParam],
      expect: [
        { name: 'base', type: 'select', label: 'Base', required: true },
        { name: 'typecast', type: 'boolean', label: 'Smart links', required: true },
        { name: 'useColumnId', type: 'boolean', label: 'Use Column ID', required: true },
        { name: 'table', type: 'select', label: 'Table', required: true },
        { name: 'id', type: 'text', label: 'Record ID', required: true },
        { name: 'record', spec: describeFields(recordSpec), type: 'collection', label: 'Record' }
      ],
      interface: [
        { name: 'id', type: 'text', label: 'ID' },
        { name: 'createdTime', type: 'date', label: 'Created Time' },
        ...recordSpec.map((f) => ({
          name: f.name,
          type: fieldTypes[f.name] || 'text',
          label: f.label || f.name
        }))
      ]
    }
  };
}

function scrappaTool(id, x, y) {
  return {
    name: 'Buscar oportunidades en la web',
    description: 'Busca oportunidades y público objetivo en la web abierta: redes sociales indexadas, blogs, foros, comunidades, directorios, marketplaces y páginas de negocios. Usala para descubrir empresas y personas interesadas. Hacé como máximo 6 búsquedas por ciclo y siempre con una consulta enfocada.',
    flow: [
      {
        id,
        module: 'scrappa:searchWebResults',
        version: 1,
        parameters: { __IMTCONN__: CONN.scrappa },
        mapper: {
          query: '{{1.query}}',
          limit: 10
        },
        metadata: {
          designer: designer(x, y, 'Buscar en Web'),
          restore: {
            parameters: {
              __IMTCONN__: { label: "ROLITO's Scrappa connection" }
            },
            expect: {
              query: {
                extra: {
                  aiHelp: 'Consulta web',
                  aiInstruction: 'Escribí una consulta específica que combine nicho, país, necesidad y señal de compra. Evitá consultas genéricas.'
                }
              }
            }
          },
          parameters: [
            {
              name: '__IMTCONN__',
              type: 'account:scrappa',
              label: 'Connection',
              required: true
            },
            { name: 'query', type: 'text', label: 'Query', required: true },
            { name: 'limit', type: 'number', label: 'Limit', default: 10, required: false }
          ],
          expect: [
            { name: 'query', type: 'text', label: 'Query', required: true },
            { name: 'limit', type: 'number', label: 'Limit', default: 10, required: false }
          ]
        }
      }
    ]
  };
}

function hunterFindTool(id, x, y) {
  return {
    name: 'Buscar contacto profesional',
    description: 'Encuentra el correo profesional de una persona concreta. Requiere el dominio oficial de la empresa, nombre y apellido. Usala solo cuando la investigación haya identificado esos tres datos; no la llames con un dominio aislado ni con una empresa sin persona.',
    flow: [
      {
        id,
        module: 'hunter:findEmail',
        version: 1,
        parameters: { __IMTCONN__: CONN.hunter },
        mapper: {
          searchCriteria: 'domain',
          domain: '{{1.domain}}',
          first_name: '{{1.firstName}}',
          last_name: '{{1.lastName}}'
        },
        metadata: {
          designer: designer(x, y, 'Encontrar Email'),
          restore: {
            parameters: {
              __IMTCONN__: { label: "ROLITO's Hunter connection" }
            },
            expect: {
              searchCriteria: { mode: 'chose', label: 'By Domain' },
              domain: {
                extra: {
                  aiHelp: 'Dominio',
                  aiInstruction: 'Dominio oficial normalizado de la empresa, sin https, sin www y sin barra final.'
                }
              },
              first_name: {
                extra: {
                  aiHelp: 'Nombre',
                  aiInstruction: 'Nombre de la persona decisora identificada.'
                }
              },
              last_name: {
                extra: {
                  aiHelp: 'Apellido',
                  aiInstruction: 'Apellido de la persona decisora identificada.'
                }
              }
            }
          },
          parameters: [
            { name: '__IMTCONN__', type: 'account:hunter', label: 'Connection', required: true }
          ],
          expect: [
            { name: 'searchCriteria', type: 'select', label: 'Search by', mappable: false, required: true, validate: { enum: ['domain', 'company'] } },
            { name: 'domain', type: 'text', label: 'Domain', required: true },
            { name: 'first_name', type: 'text', label: 'First Name' },
            { name: 'last_name', type: 'text', label: 'Last Name' },
            { name: 'full_name', type: 'text', label: 'Full Name' },
            { name: 'max_duration', type: 'uinteger', label: 'Max Duration', default: 5, validate: { max: 20, min: 3 } }
          ]
        }
      }
    ]
  };
}

function hunterVerifyTool(id, x, y) {
  return {
    name: 'Verificar email',
    description: 'Verifica si un correo profesional puede recibir mensajes. No permitas el envío si el resultado indica que el correo es inválido, riesgoso o no verificable.',
    flow: [
      {
        id,
        module: 'hunter:verifyEmail',
        version: 1,
        parameters: { __IMTCONN__: CONN.hunter },
        mapper: {
          email: '{{1.email}}'
        },
        metadata: {
          designer: designer(x, y, 'Verificar Email'),
          restore: {
            parameters: {
              __IMTCONN__: { label: "ROLITO's Hunter connection" }
            },
            expect: {
              email: {
                extra: {
                  aiHelp: 'Email',
                  aiInstruction: 'Correo profesional devuelto por la búsqueda de contacto, listo para verificar.'
                }
              }
            }
          },
          parameters: [
            { name: '__IMTCONN__', type: 'account:hunter', label: 'Connection', required: true }
          ],
          expect: [
            { name: 'email', type: 'email', label: 'Email', required: true }
          ]
        }
      }
    ]
  };
}

function telegramModule({ id, x, y, text, name = 'Informe Telegram' }) {
  return {
    id,
    module: 'telegram:SendReplyMessage',
    version: 1,
    parameters: { __IMTCONN__: CONN.telegram },
    mapper: {
      chatId: CHAT_ID,
      text
    },
    metadata: {
      designer: designer(x, y, name),
      restore: {
        parameters: {
          __IMTCONN__: { label: "ROLITO's Telegram Bot connection" }
        },
        expect: {
          chatId: {
            extra: {
              aiHelp: 'Chat ID',
              aiInstruction: 'Identificador del chat del dueño.'
            }
          },
          text: {
            extra: {
              aiHelp: 'Texto',
              aiInstruction: 'Informe breve, truncado para entrar en el límite de Telegram.'
            }
          }
        }
      },
      parameters: [
        { name: '__IMTCONN__', type: 'account:telegram', label: 'Connection', required: true }
      ],
      expect: [
        { name: 'chatId', type: 'text', label: 'Chat ID', required: true },
        { name: 'text', type: 'text', label: 'Text', required: true },
        { name: 'messageThreadId', type: 'number', label: 'Message Thread ID' },
        { name: 'parseMode', type: 'select', label: 'Parse Mode', validate: { enum: ['Markdown', 'HTML'] } },
        { name: 'disableNotification', type: 'boolean', label: 'Disable Notifications', editable: true },
        { name: 'disableWebPagePreview', type: 'boolean', label: 'Disable Link Previews' },
        { name: 'replyToMessageId', type: 'number', label: 'Original Message ID', advanced: true },
        { name: 'replyMarkupAssembleType', type: 'select', label: 'Enter/Assemble the Reply Markup Field', default: 'reply_markup_enter', advanced: true, validate: { enum: ['reply_markup_enter', 'reply_markup_assemble'] } }
      ]
    }
  };
}

function microsoftSendModule({ id, x, y, toRecipients, subject, content, name = 'Enviar Email' }) {
  return {
    id,
    module: 'microsoft-email:createAndSendAMessage',
    version: 2,
    parameters: { __IMTCONN__: CONN.microsoft },
    mapper: {
      toRecipients,
      subject,
      content,
      contentType: 'html'
    },
    metadata: {
      designer: designer(x, y, name),
      restore: {
        parameters: {
          __IMTCONN__: { label: "ROLITO's Microsoft connection" }
        },
        expect: {
          contentType: { mode: 'chose', label: 'HTML' },
          toRecipients: {
            extra: {
              aiHelp: 'To Recipients',
              aiInstruction: 'Proporcioná un destinatario profesional verificado con dirección y, si se conoce, nombre.'
            }
          },
          subject: {
            extra: {
              aiHelp: 'Subject',
              aiInstruction: 'Asunto conciso y honesto, adaptado al interés de la empresa.'
            }
          },
          content: {
            extra: {
              aiHelp: 'Body Content',
              aiInstruction: 'Cuerpo HTML breve y respetuoso. No inventes precios, certificaciones, plazos ni capacidades.'
            }
          }
        }
      },
      parameters: [
        { name: '__IMTCONN__', type: 'account:azure', label: 'Connection', required: true }
      ],
      expect: [
        {
          name: 'toRecipients',
          spec: [
            { name: 'address', type: 'email', label: 'Email Address', required: true },
            { name: 'name', type: 'text', label: 'Name' }
          ],
          type: 'array',
          label: 'To Recipients',
          required: true
        },
        { name: 'subject', type: 'text', label: 'Subject', required: true },
        { name: 'content', type: 'text', label: 'Body Content', required: true },
        {
          name: 'attachments',
          spec: [
            { name: 'filename', type: 'filename', label: 'File Name', required: true, semantic: 'file:name' },
            { name: 'data', type: 'buffer', label: 'Data', required: true, semantic: 'file:data' }
          ],
          type: 'array',
          label: 'Attachments'
        },
        {
          name: 'replyTo',
          spec: [
            { name: 'address', type: 'email', label: 'Email Address', required: true },
            { name: 'name', type: 'text', label: 'Name' }
          ],
          type: 'array',
          label: 'Reply To'
        },
        {
          name: 'from',
          spec: [
            { name: 'address', type: 'email', label: 'Email Address', required: true },
            { name: 'name', type: 'text', label: 'Name' }
          ],
          type: 'array',
          label: 'From',
          advanced: true,
          validate: { maxItems: 1 }
        },
        {
          name: 'ccRecipients',
          spec: [
            { name: 'address', type: 'email', label: 'Email Address', required: true },
            { name: 'name', type: 'text', label: 'Name' }
          ],
          type: 'array',
          label: 'CC Recipients',
          advanced: true
        },
        {
          name: 'bccRecipients',
          spec: [
            { name: 'address', type: 'email', label: 'Email Address', required: true },
            { name: 'name', type: 'text', label: 'Name' }
          ],
          type: 'array',
          label: 'Bcc Recipients',
          advanced: true
        },
        { name: 'importance', type: 'select', label: 'Importance', advanced: true, validate: { enum: ['Low', 'Normal', 'High'] } },
        {
          name: 'internetMessageHeaders',
          spec: [
            { name: 'name', type: 'text', label: 'Name', required: true },
            { name: 'value', type: 'text', label: 'Value', required: true }
          ],
          type: 'array',
          label: 'Internet Message Headers',
          advanced: true
        },
        { name: 'contentType', type: 'select', label: 'Body Content Type', advanced: true, required: true, validate: { enum: ['html', 'text'] } },
        {
          name: 'singleValueExtendedProperties',
          spec: [{ name: 'sensitivityLabel', type: 'text', label: 'Sensitivity Label' }],
          type: 'collection',
          label: 'Extended MAPI Properties',
          advanced: true
        }
      ]
    }
  };
}

const productFields = ['Producto', 'SKU', 'Estado', 'Descripcion_corta', 'Descripcion_larga', 'Precio', 'Moneda', 'Material', 'Medidas', 'Colores', 'Lead_time_dias', 'Capacidad_semanal', 'Link_ficha', 'Nicho_ideal', 'Paises_objetivo', 'Argumentos_venta'];
const leadFields = ['Lead', 'Tipo', 'Dominio', 'Web', 'Pais', 'Ciudad', 'Idioma', 'Nicho', 'Producto_interes', 'Fuente_URL', 'Senal', 'Score', 'Estado', 'Contacto_nombre', 'Contacto_cargo', 'Contacto_email', 'Email_estado', 'Fecha_alta', 'Ultimo_contacto', 'Proximo_paso', 'Notas'];
const outboxFields = ['Asunto', 'Lead', 'Para', 'Nombre_destinatario', 'Cuerpo_HTML', 'Idioma', 'Producto', 'Paso', 'Estado', 'Programado_para', 'Enviado_en', 'Message_ID', 'Respondido', 'Notas'];
const conversationFields = ['Asunto', 'Lead', 'Contacto', 'Email', 'Canal', 'Direccion', 'Clasificacion', 'Sentimiento', 'Resumen', 'Borrador_respuesta', 'Estado', 'Fecha', 'Message_ID', 'Notas'];
const contentFields = ['Titulo', 'Plataforma', 'Formato', 'Gancho', 'Copy', 'Hashtags', 'CTA', 'Producto', 'Estado', 'Fecha_publicacion', 'Metricas', 'Aprendizaje'];
const configFields = ['Clave', 'Valor'];
const metricsFields = ['Fecha', 'Leads_nuevos', 'Emails_enviados', 'Respuestas', 'Respuestas_positivas', 'Reuniones', 'Propuestas', 'Ventas', 'Ingresos', 'Notas'];
const learningFields = ['Hallazgo', 'Fecha', 'Fuente', 'Evidencia', 'Accion', 'Agente'];

const leadFieldTypes = {
  Score: 'number',
  Fecha_alta: 'date',
  Ultimo_contacto: 'date',
  Contacto_email: 'email',
  Web: 'url',
  Fuente_URL: 'url'
};
const outboxFieldTypes = {
  Paso: 'number',
  Respondido: 'boolean',
  Programado_para: 'date',
  Enviado_en: 'date',
  Para: 'email'
};
const conversationFieldTypes = {
  Fecha: 'date',
  Email: 'email'
};
const productFieldTypes = {
  Precio: 'number',
  Lead_time_dias: 'number',
  Capacidad_semanal: 'number',
  Link_ficha: 'url'
};
const contentFieldTypes = { Fecha_publicacion: 'date' };
const metricsFieldTypes = {
  Leads_nuevos: 'number',
  Emails_enviados: 'number',
  Respuestas: 'number',
  Respuestas_positivas: 'number',
  Reuniones: 'number',
  Propuestas: 'number',
  Ventas: 'number',
  Ingresos: 'number'
};

function toolFromModule(name, description, module) {
  return { name, description, flow: [module] };
}

const promConfig = await readFile(path.join(ROOT, 'prompts', '01-director-comercial.md'), 'utf8');
const promReply = await readFile(path.join(ROOT, 'prompts', '03-analista-respuestas.md'), 'utf8');
const promMarketing = await readFile(path.join(ROOT, 'prompts', '04-director-marketing.md'), 'utf8');

const salesTools = [
  toolFromModule(
    'Leer configuracion',
    'Devuelve la configuración de la marca: marca, web, firma, moneda, idiomas, límites, modo de envío, nichos, países, propuesta de valor y prohibiciones. Usala al inicio de cada ciclo.',
    airtableSearch({ id: 10, x: 300, y: 120, name: 'Leer Config', table: T.config, tableLabel: 'Config', fields: configFields, maxRecords: 40 })
  ),
  toolFromModule(
    'Leer catalogo de productos',
    'Devuelve los productos activos con precio, moneda, materiales, medidas, lead time, argumentos y link de ficha. Usala antes de escribir cualquier propuesta.',
    airtableSearch({ id: 11, x: 300, y: 260, name: 'Leer Catalogo', table: T.productos, tableLabel: 'Productos', fields: productFields, formula: "{Estado}=\"Activo\"", maxRecords: 10, fieldTypes: productFieldTypes })
  ),
  toolFromModule(
    'Leer leads y oportunidades',
    'Devuelve los leads existentes con estado, contacto, score e historial. Usala para evitar duplicados y para decidir a quién contactar.',
    airtableSearch({ id: 12, x: 300, y: 400, name: 'Leer Leads', table: T.leads, tableLabel: 'Leads', fields: leadFields, maxRecords: 60, fieldTypes: leadFieldTypes })
  ),
  toolFromModule(
    'Leer outbox y seguimientos',
    'Devuelve los borradores y correos enviados con estado, paso, fechas y respuesta. Usala para no repetir contactos y para detectar seguimientos pendientes.',
    airtableSearch({ id: 13, x: 300, y: 540, name: 'Leer Outbox', table: T.outbox, tableLabel: 'Outbox', fields: outboxFields, maxRecords: 60, fieldTypes: outboxFieldTypes })
  ),
  toolFromModule(
    'Leer conversaciones',
    'Devuelve las respuestas recibidas, su clasificación, resumen y objeción principal. Usala para aprender y para no contradecir promesas anteriores.',
    airtableSearch({ id: 14, x: 300, y: 680, name: 'Leer Conversaciones', table: T.conversaciones, tableLabel: 'Conversaciones', fields: conversationFields, maxRecords: 40, fieldTypes: conversationFieldTypes })
  ),
  toolFromModule(
    'Leer aprendizajes',
    'Devuelve los patrones comerciales ya validados con su evidencia y acción. Usalos para ajustar las hipótesis del ciclo.',
    airtableSearch({ id: 15, x: 300, y: 820, name: 'Leer Aprendizajes', table: T.aprendizajes, tableLabel: 'Aprendizajes', fields: learningFields, maxRecords: 20 })
  ),
  scrappaTool(16, 300, 960),
  toolFromModule(
    'Guardar lead',
    'Crea un lead calificado en Airtable. Usala solo después de investigar, asignar score 3-5 y verificar que el dominio no exista. No guardes leads sin fuente ni señal.',
    airtableCreate({
      id: 17, x: 300, y: 1100, name: 'Guardar Lead', table: T.leads, tableLabel: 'Leads',
      recordSpec: [
        { name: 'Lead', type: 'text', label: 'Empresa o persona' },
        { name: 'Tipo', type: 'text', label: 'Tipo de comprador' },
        { name: 'Dominio', type: 'text', label: 'Dominio' },
        { name: 'Web', type: 'url', label: 'Web' },
        { name: 'Pais', type: 'text', label: 'País' },
        { name: 'Ciudad', type: 'text', label: 'Ciudad' },
        { name: 'Idioma', type: 'text', label: 'Idioma' },
        { name: 'Nicho', type: 'text', label: 'Nicho' },
        { name: 'Producto_interes', type: 'text', label: 'Producto de interés' },
        { name: 'Fuente_URL', type: 'url', label: 'Fuente' },
        { name: 'Senal', type: 'text', label: 'Señal' },
        { name: 'Score', type: 'number', label: 'Score 1-5' },
        { name: 'Estado', type: 'text', label: 'Estado' },
        { name: 'Contacto_nombre', type: 'text', label: 'Nombre del contacto' },
        { name: 'Contacto_cargo', type: 'text', label: 'Cargo del contacto' },
        { name: 'Contacto_email', type: 'email', label: 'Email del contacto' },
        { name: 'Email_estado', type: 'text', label: 'Estado del email' },
        { name: 'Fecha_alta', type: 'date', label: 'Fecha de alta' },
        { name: 'Notas', type: 'text', label: 'Notas' }
      ],
      aiInstructions: {
        Lead: { help: 'Nombre de la empresa o persona.', instruction: 'Usá el nombre comercial exacto. Si es una persona, usá nombre y apellido.' },
        Tipo: { help: 'Empresa, Particular, Estudio, Hotel, Restaurante, Retail, Evento u Otro.', instruction: 'Elegí el tipo que mejor describa al comprador.' },
        Dominio: { help: 'Dominio normalizado.', instruction: 'Sin https, sin www y sin barra final. Debe ser verificable.' },
        Web: { help: 'URL oficial.', instruction: 'URL completa del sitio oficial o de la página de negocio.' },
        Pais: { help: 'País.', instruction: 'País donde opera el comprador.' },
        Ciudad: { help: 'Ciudad.', instruction: 'Ciudad principal, si se conoce.' },
        Idioma: { help: 'es, en, pt, fr, it, de u otro.', instruction: 'Idioma probable del prospecto.' },
        Nicho: { help: 'Nicho o categoría.', instruction: 'Ejemplo: hotel boutique, estudio de interiorismo, restaurante de diseño.' },
        Producto_interes: { help: 'Producto del catálogo.', instruction: 'Nombre exacto del producto activo que mejor encaja.' },
        Fuente_URL: { help: 'URL de la fuente.', instruction: 'URL exacta donde encontraste la señal. No uses la home si la señal está en otra página.' },
        Senal: { help: 'Evidencia concreta.', instruction: 'Una frase con la señal de interés o necesidad y, si existe, la fecha del proyecto.' },
        Score: { help: '1 a 5.', instruction: '5 = necesidad explícita + proyecto + decisor + contacto verificable. 3 = encaje razonable sin necesidad confirmada. No guardes menor a 3.' },
        Estado: { help: 'Estado del lead.', instruction: 'Usá siempre Investigado al crear.' },
        Contacto_nombre: { help: 'Nombre del contacto.', instruction: 'Nombre y apellido del decisor identificado. Si no lo encontraste, omití este campo.' },
        Contacto_cargo: { help: 'Cargo.', instruction: 'Cargo o rol del decisor. Si no lo encontraste, omití este campo.' },
        Contacto_email: { help: 'Email del contacto.', instruction: 'Correo profesional verificado. Si aún no está verificado, omitilo y explicá en Notas.' },
        Email_estado: { help: 'pending, valid, risky, invalid o unknown.', instruction: 'Usá pending si aún no verificaste; usá valid, risky, invalid o unknown según el resultado real de Hunter.' },
        Fecha_alta: { help: 'Fecha ISO.', instruction: 'Usá la fecha de hoy en formato YYYY-MM-DD.' },
        Notas: { help: 'Notas.', instruction: 'Opcional. Incluí el motivo de encaje, el resultado de la verificación y el siguiente paso.' }
      },
      fieldTypes: leadFieldTypes
    })
  ),
  hunterFindTool(18, 300, 1240),
  hunterVerifyTool(19, 300, 1380),
  toolFromModule(
    'Crear borrador de email',
    'Crea un borrador en Outbox para aprobación humana. No envía. Usala solo con un email verificado y un producto activo. Si Config.modo_envio = auto, podés usar Estado = Aprobado; si no, usá En_revision.',
    airtableCreate({
      id: 20, x: 300, y: 1520, name: 'Crear Borrador', table: T.outbox, tableLabel: 'Outbox',
      recordSpec: [
        { name: 'Asunto', type: 'text', label: 'Asunto' },
        { name: 'Lead', type: 'text', label: 'Lead' },
        { name: 'Para', type: 'email', label: 'Para' },
        { name: 'Nombre_destinatario', type: 'text', label: 'Nombre del destinatario' },
        { name: 'Cuerpo_HTML', type: 'text', label: 'Cuerpo HTML' },
        { name: 'Idioma', type: 'text', label: 'Idioma' },
        { name: 'Producto', type: 'text', label: 'Producto' },
        { name: 'Paso', type: 'number', label: 'Paso' },
        { name: 'Estado', type: 'text', label: 'Estado' },
        { name: 'Programado_para', type: 'date', label: 'Programado para' },
        { name: 'Respondido', type: 'boolean', label: 'Respondido' },
        { name: 'Notas', type: 'text', label: 'Notas' }
      ],
      aiInstructions: {
        Asunto: { help: 'Asunto del correo.', instruction: 'Máximo 60 caracteres. Observación específica + beneficio concreto. Sin mayúsculas gritadas ni emojis.' },
        Lead: { help: 'Empresa o persona.', instruction: 'Nombre exacto del lead al que escribís.' },
        Para: { help: 'Email verificado.', instruction: 'Solo un correo profesional verificado. No uses correos inválidos, riesgosos o no verificables.' },
        Nombre_destinatario: { help: 'Nombre.', instruction: 'Nombre de la persona.' },
        Cuerpo_HTML: { help: 'Cuerpo HTML.', instruction: 'Entre 90 y 140 palabras en el primer contacto; 50 a 90 en seguimientos. Incluí la firma y la línea de baja. No inventes datos.' },
        Idioma: { help: 'Idioma.', instruction: 'Idioma del prospecto: es, en, pt, fr, it, de u otro.' },
        Producto: { help: 'Producto.', instruction: 'Nombre exacto de un producto activo del catálogo.' },
        Paso: { help: '1, 2 o 3.', instruction: '1 = primer contacto; 2 = primer seguimiento; 3 = segundo y último seguimiento.' },
        Estado: { help: 'En_revision o Aprobado.', instruction: 'Usá En_revision si Config.modo_envio = manual. Usá Aprobado solo si Config.modo_envio = auto.' },
        Programado_para: { help: 'Fecha ISO.', instruction: 'Si el modo es auto, usá la fecha y hora actual en ISO. Si es manual, omitilo.' },
        Respondido: { help: 'Booleano.', instruction: 'Usá false.' },
        Notas: { help: 'Notas.', instruction: 'Motivo del encaje y ángulo elegido. Sin datos inventados.' }
      },
      fieldTypes: outboxFieldTypes
    })
  ),
  toolFromModule(
    'Actualizar lead',
    'Actualiza el estado, el último contacto y el próximo paso de un lead. Usala después de crear un borrador o cuando cambie el estado comercial.',
    airtableUpdate({
      id: 21, x: 300, y: 1660, name: 'Actualizar Lead', table: T.leads, tableLabel: 'Leads',
      recordSpec: [
        { name: 'Estado', type: 'text', label: 'Estado' },
        { name: 'Ultimo_contacto', type: 'date', label: 'Último contacto' },
        { name: 'Proximo_paso', type: 'text', label: 'Próximo paso' }
      ],
      aiInstructions: {
        Estado: { help: 'Estado.', instruction: 'Usá Contactado después de crear un borrador; Respondio, Calificado, Propuesta, Ganado, Perdido u OptOut según corresponda.' },
        Ultimo_contacto: { help: 'Fecha ISO.', instruction: 'Usá la fecha de hoy en formato YYYY-MM-DD.' },
        Proximo_paso: { help: 'Próximo paso.', instruction: 'Ejemplo: Seguimiento 1 en 4 días; Llamada agendada; Esperando respuesta.' }
      },
      idInstruction: 'Usá el id del registro de la tabla Leads que devolvió Leer leads y oportunidades. No inventes un id.',
      fieldTypes: leadFieldTypes
    })
  ),
  toolFromModule(
    'Guardar aprendizaje',
    'Guarda un patrón comercial con evidencia y acción. Usala como máximo una vez por ciclo y solo si el patrón es claro y accionable.',
    airtableCreate({
      id: 22, x: 300, y: 1800, name: 'Guardar Aprendizaje', table: T.aprendizajes, tableLabel: 'Aprendizajes',
      recordSpec: [
        { name: 'Hallazgo', type: 'text', label: 'Hallazgo' },
        { name: 'Fecha', type: 'date', label: 'Fecha' },
        { name: 'Fuente', type: 'text', label: 'Fuente' },
        { name: 'Evidencia', type: 'text', label: 'Evidencia' },
        { name: 'Accion', type: 'text', label: 'Acción' },
        { name: 'Agente', type: 'text', label: 'Agente' }
      ],
      aiInstructions: {
        Hallazgo: { help: 'Hallazgo.', instruction: 'Una frase concreta y accionable. No escribas obviedades.' },
        Fecha: { help: 'Fecha ISO.', instruction: 'Usá la fecha de hoy en formato YYYY-MM-DD.' },
        Fuente: { help: 'Fuente.', instruction: 'Fuente o conjunto de datos que sustenta el hallazgo.' },
        Evidencia: { help: 'Evidencia.', instruction: 'Datos concretos: respuestas, tasas, objeciones, nichos.' },
        Accion: { help: 'Acción.', instruction: 'Qué cambiaremos en el próximo ciclo.' },
        Agente: { help: 'Agente.', instruction: 'Usá Comercial.' }
      }
    })
  )
];

const salesMessage = 'Ejecutá el ciclo comercial de hoy ({{formatDate(now; "YYYY-MM-DD")}}, America/Argentina/Buenos_Aires). Leé Config y catálogo antes de actuar. Investigá, calificá, verificá contactos y creá como máximo 3 borradores en Outbox. No envíes correos. Devolvé el informe final con el formato indicado.';

const salesBlueprint = {
  name: '01 - Motor Comercial (Prospeccion + Borradores)',
  flow: [
    agentModule({ id: 1, prompt: promConfig, message: salesMessage, tools: salesTools, name: 'Director Comercial', x: 0, y: 0 }),
    telegramModule({
      id: 2, x: 450, y: 0,
      text: 'MOTOR COMERCIAL - {{formatDate(now; "DD/MM/YYYY HH:mm")}}\n\n{{substring(1.response; 0; 3700)}}'
    })
  ],
  metadata: scenarioMetadata(false)
};

const sendSearchFields = ['Asunto', 'Lead', 'Para', 'Nombre_destinatario', 'Cuerpo_HTML', 'Idioma', 'Producto', 'Paso', 'Estado', 'Programado_para', 'Enviado_en', 'Message_ID', 'Respondido', 'Notas'];

const sendSearch = airtableSearch({
  id: 1, x: 0, y: 0, name: 'Buscar Aprobados', table: T.outbox, tableLabel: 'Outbox',
  fields: sendSearchFields, formula: "{Estado}=\"Aprobado\"", maxRecords: 5, fieldTypes: outboxFieldTypes
});
sendSearch.metadata.designer = designer(0, 0, 'Buscar Aprobados');

const sendUpdate = airtableUpdate({
  id: 3, x: 600, y: 0, name: 'Marcar Enviado', table: T.outbox, tableLabel: 'Outbox',
  recordSpec: [
    { name: 'Estado', type: 'text', label: 'Estado' },
    { name: 'Enviado_en', type: 'date', label: 'Enviado en' },
    { name: 'Message_ID', type: 'text', label: 'Message ID' }
  ],
  aiInstructions: {},
  idInstruction: 'Usá el id del registro de Outbox que se acaba de enviar.',
  fieldTypes: outboxFieldTypes
});
sendUpdate.mapper = {
  id: '{{1.id}}',
  base: BASE,
  table: T.outbox,
  record: {
    Estado: 'Enviado',
    Enviado_en: '{{now}}',
    Message_ID: '{{2.id}}'
  },
  typecast: true,
  useColumnId: false
};

const sendBlueprint = {
  name: '02 - Envio Aprobado (Outbox)',
  flow: [
    sendSearch,
    microsoftSendModule({
      id: 2, x: 300, y: 0,
      toRecipients: [{ address: '{{1.Para}}', name: '{{1.Nombre_destinatario}}' }],
      subject: '{{1.Asunto}}',
      content: '{{1.Cuerpo_HTML}}',
      name: 'Enviar Aprobado'
    }),
    sendUpdate,
    telegramModule({
      id: 4, x: 900, y: 0,
      text: 'EMAIL ENVIADO\n\nPara: {{1.Para}}\nAsunto: {{1.Asunto}}\nLead: {{1.Lead}}\nProducto: {{1.Producto}}'
    })
  ],
  metadata: scenarioMetadata(true)
};

const replyTools = [
  toolFromModule(
    'Leer configuracion',
    'Devuelve la configuración de la marca y las prohibiciones. Usala antes de redactar cualquier respuesta.',
    airtableSearch({ id: 10, x: 300, y: 120, name: 'Leer Config', table: T.config, tableLabel: 'Config', fields: configFields, maxRecords: 40 })
  ),
  toolFromModule(
    'Leer catalogo de productos',
    'Devuelve los productos activos con precio, materiales, medidas y link de ficha. Usala para responder con datos reales.',
    airtableSearch({ id: 11, x: 300, y: 260, name: 'Leer Catalogo', table: T.productos, tableLabel: 'Productos', fields: productFields, formula: "{Estado}=\"Activo\"", maxRecords: 10, fieldTypes: productFieldTypes })
  ),
  toolFromModule(
    'Leer leads',
    'Devuelve los leads con id, dominio, email, estado e historial. Usala para identificar al remitente por email o dominio.',
    airtableSearch({ id: 12, x: 300, y: 400, name: 'Leer Leads', table: T.leads, tableLabel: 'Leads', fields: leadFields, maxRecords: 80, fieldTypes: leadFieldTypes })
  ),
  toolFromModule(
    'Guardar conversacion',
    'Guarda la respuesta entrante con clasificación, sentimiento, resumen y borrador. No envía nada.',
    airtableCreate({
      id: 13, x: 300, y: 540, name: 'Guardar Conversacion', table: T.conversaciones, tableLabel: 'Conversaciones',
      recordSpec: [
        { name: 'Asunto', type: 'text', label: 'Asunto' },
        { name: 'Lead', type: 'text', label: 'Lead' },
        { name: 'Contacto', type: 'text', label: 'Contacto' },
        { name: 'Email', type: 'email', label: 'Email' },
        { name: 'Canal', type: 'text', label: 'Canal' },
        { name: 'Direccion', type: 'text', label: 'Dirección' },
        { name: 'Clasificacion', type: 'text', label: 'Clasificación' },
        { name: 'Sentimiento', type: 'text', label: 'Sentimiento' },
        { name: 'Resumen', type: 'text', label: 'Resumen' },
        { name: 'Mensaje_original', type: 'text', label: 'Mensaje original' },
        { name: 'Borrador_respuesta', type: 'text', label: 'Borrador de respuesta' },
        { name: 'Estado', type: 'text', label: 'Estado' },
        { name: 'Fecha', type: 'date', label: 'Fecha' },
        { name: 'Message_ID', type: 'text', label: 'Message ID' },
        { name: 'Notas', type: 'text', label: 'Notas' }
      ],
      aiInstructions: {
        Asunto: { help: 'Asunto.', instruction: 'Asunto original del correo entrante.' },
        Lead: { help: 'Lead.', instruction: 'Nombre del lead si lo encontraste; si no, usá el nombre del remitente.' },
        Contacto: { help: 'Contacto.', instruction: 'Nombre y apellido del remitente si están disponibles.' },
        Email: { help: 'Email.', instruction: 'Email del remitente.' },
        Canal: { help: 'Canal.', instruction: 'Usá Email.' },
        Direccion: { help: 'Dirección.', instruction: 'Usá Entrante.' },
        Clasificacion: { help: 'Clasificación.', instruction: 'Interesado, Pide_precio, Pide_catalogo, Objecion, No_interesado, OptOut, Spam, Socio u Otro.' },
        Sentimiento: { help: 'Sentimiento.', instruction: 'Positivo, Neutral o Negativo.' },
        Resumen: { help: 'Resumen.', instruction: 'Una o dos frases con lo que quiere la persona.' },
        Mensaje_original: { help: 'Mensaje original.', instruction: 'Cuerpo original del correo entrante, sin editar ni resumir.' },
        Borrador_respuesta: { help: 'Borrador.', instruction: 'Respuesta completa de 60 a 140 palabras, en el idioma del remitente, con firma y línea de baja. No inventes datos.' },
        Estado: { help: 'Estado.', instruction: 'Pendiente si necesita respuesta; Cerrada si es spam, baja o no requiere respuesta.' },
        Fecha: { help: 'Fecha ISO.', instruction: 'Usá la fecha de hoy en formato YYYY-MM-DD.' },
        Message_ID: { help: 'Message ID.', instruction: 'ID del correo si está disponible.' },
        Notas: { help: 'Notas.', instruction: 'Datos útiles para el dueño: objeción, urgencia, presupuesto, cantidad.' }
      },
      fieldTypes: conversationFieldTypes
    })
  ),
  toolFromModule(
    'Actualizar lead',
    'Actualiza el estado del lead después de clasificar la respuesta.',
    airtableUpdate({
      id: 14, x: 300, y: 680, name: 'Actualizar Lead', table: T.leads, tableLabel: 'Leads',
      recordSpec: [
        { name: 'Estado', type: 'text', label: 'Estado' },
        { name: 'Ultimo_contacto', type: 'date', label: 'Último contacto' },
        { name: 'Proximo_paso', type: 'text', label: 'Próximo paso' }
      ],
      aiInstructions: {
        Estado: { help: 'Estado.', instruction: 'Interesado/Pide precio/Pide catálogo -> Calificado o Propuesta; Objeción -> Respondio; No interesado -> Perdido; OptOut -> OptOut; Socio -> Respondio.' },
        Ultimo_contacto: { help: 'Fecha ISO.', instruction: 'Usá la fecha de hoy.' },
        Proximo_paso: { help: 'Próximo paso.', instruction: 'Acción concreta y fecha si corresponde.' }
      },
      idInstruction: 'Usá el id del lead que devolvió Leer leads. Si no encontraste el lead, no llames a esta herramienta.',
      fieldTypes: leadFieldTypes
    })
  ),
  toolFromModule(
    'Crear borrador de respuesta',
    'Crea un borrador de respuesta en Outbox con Estado = En_revision. No envía. Usala solo si la clasificación no es Spam, OptOut ni No_interesado.',
    airtableCreate({
      id: 15, x: 300, y: 820, name: 'Crear Borrador Respuesta', table: T.outbox, tableLabel: 'Outbox',
      recordSpec: [
        { name: 'Asunto', type: 'text', label: 'Asunto' },
        { name: 'Lead', type: 'text', label: 'Lead' },
        { name: 'Para', type: 'email', label: 'Para' },
        { name: 'Nombre_destinatario', type: 'text', label: 'Nombre del destinatario' },
        { name: 'Cuerpo_HTML', type: 'text', label: 'Cuerpo HTML' },
        { name: 'Idioma', type: 'text', label: 'Idioma' },
        { name: 'Producto', type: 'text', label: 'Producto' },
        { name: 'Paso', type: 'number', label: 'Paso' },
        { name: 'Estado', type: 'text', label: 'Estado' },
        { name: 'Respondido', type: 'boolean', label: 'Respondido' },
        { name: 'Notas', type: 'text', label: 'Notas' }
      ],
      aiInstructions: {
        Asunto: { help: 'Asunto.', instruction: 'Usá "Re: {asunto original}" salvo que ya empiece con Re:.' },
        Lead: { help: 'Lead.', instruction: 'Nombre del lead.' },
        Para: { help: 'Email.', instruction: 'Email del remitente.' },
        Nombre_destinatario: { help: 'Nombre.', instruction: 'Nombre de la persona.' },
        Cuerpo_HTML: { help: 'Cuerpo HTML.', instruction: 'Respuesta de 60 a 140 palabras, con firma y línea de baja. Respondé exactamente lo que preguntó.' },
        Idioma: { help: 'Idioma.', instruction: 'Idioma del remitente.' },
        Producto: { help: 'Producto.', instruction: 'Producto activo relacionado, si corresponde.' },
        Paso: { help: 'Paso.', instruction: 'Usá 0 para respuestas.' },
        Estado: { help: 'Estado.', instruction: 'Usá En_revision. Solo usá Aprobado si Config.modo_envio = auto y la clasificación es segura.' },
        Respondido: { help: 'Respondido.', instruction: 'Usá false.' },
        Notas: { help: 'Notas.', instruction: 'Aclaración para el dueño.' }
      },
      fieldTypes: outboxFieldTypes
    })
  ),
  (() => {
    const search = airtableSearch({
      id: 16, x: 300, y: 960, name: 'Buscar Borradores del Email', table: T.outbox, tableLabel: 'Outbox',
      fields: ['Asunto', 'Para', 'Estado'], formula: '{{2.formula}}', maxRecords: 20, fieldTypes: outboxFieldTypes
    });
    search.metadata.restore.expect.formula = {
      extra: {
        aiHelp: 'Fórmula Airtable',
        aiInstruction: 'Escribí una fórmula que filtre los borradores pendientes o aprobados del remitente. Ejemplo: AND({Para}="persona@empresa.com", OR({Estado}="En_revision", {Estado}="Aprobado")). Usá el email exacto del remitente y no inventes campos.'
      }
    };
    return toolFromModule(
      'Buscar borradores del email',
      'Busca los borradores pendientes o aprobados de un email cuando la persona pide baja o dice que no le interesa. Usala para OptOut o No_interesado. Escribí una fórmula Airtable que filtre por {Para} y Estado="En_revision" o Estado="Aprobado".',
      search
    );
  })(),
  (() => {
    const update = airtableUpdate({
      id: 17, x: 600, y: 960, name: 'Cancelar Borrador', table: T.outbox, tableLabel: 'Outbox',
      recordSpec: [{ name: 'Estado', type: 'text', label: 'Estado' }],
      aiInstructions: {},
      idInstruction: 'Usá el id de un borrador que devolvió Buscar borradores del email. No inventes un id.',
      fieldTypes: outboxFieldTypes
    });
    update.mapper = {
      id: '{{2.id}}',
      base: BASE,
      table: T.outbox,
      record: { Estado: 'Cancelado' },
      typecast: true,
      useColumnId: false
    };
    update.metadata.restore.expect.id = {
      extra: {
        aiHelp: 'Record ID',
        aiInstruction: 'Usá el id del borrador que devolvió Buscar borradores del email.'
      }
    };
    update.metadata.designer = designer(600, 960, 'Cancelar Borrador');
    return toolFromModule(
      'Cancelar borrador',
      'Cancela un borrador por su Record ID. Usala para OptOut o No_interesado, después de Buscar borradores del email y por cada id devuelto.',
      update
    );
  })(),
  (() => {
    const search = airtableSearch({
      id: 18, x: 300, y: 1100, name: 'Buscar Envios del Email', table: T.outbox, tableLabel: 'Outbox',
      fields: ['Asunto', 'Para', 'Estado', 'Respondido'], formula: '{{2.formula}}', maxRecords: 20, fieldTypes: outboxFieldTypes
    });
    search.metadata.restore.expect.formula = {
      extra: {
        aiHelp: 'Fórmula Airtable',
        aiInstruction: 'Escribí una fórmula que filtre los envíos del remitente. Ejemplo: AND({Para}="persona@empresa.com", {Estado}="Enviado"). Usá el email exacto del remitente y no inventes campos.'
      }
    };
    return toolFromModule(
      'Buscar envios del email',
      'Busca los correos enviados a un email para marcarlos como respondidos cuando la persona contesta. Usala para cualquier respuesta que no sea spam.',
      search
    );
  })(),
  (() => {
    const update = airtableUpdate({
      id: 19, x: 600, y: 1100, name: 'Marcar Envio Respondido', table: T.outbox, tableLabel: 'Outbox',
      recordSpec: [
        { name: 'Estado', type: 'text', label: 'Estado' },
        { name: 'Respondido', type: 'boolean', label: 'Respondido' }
      ],
      aiInstructions: {},
      idInstruction: 'Usá el id de un envio que devolvió Buscar envios del email. No inventes un id.',
      fieldTypes: outboxFieldTypes
    });
    update.mapper = {
      id: '{{2.id}}',
      base: BASE,
      table: T.outbox,
      record: { Estado: 'Respondido', Respondido: true },
      typecast: true,
      useColumnId: false
    };
    update.metadata.restore.expect.id = {
      extra: {
        aiHelp: 'Record ID',
        aiInstruction: 'Usá el id de un envio que devolvió Buscar envios del email.'
      }
    };
    update.metadata.designer = designer(600, 1100, 'Marcar Envio Respondido');
    return toolFromModule(
      'Marcar envio respondido',
      'Marca un envio como respondido por su Record ID. Usala después de Buscar envios del email y por cada id devuelto.',
      update
    );
  })()
];

const replyTrigger = {
  id: 1,
  module: 'microsoft-email:watchEmails',
  version: 1,
  parameters: {
    __IMTCONN__: CONN.microsoft,
    folder: 'INBOX',
    criteria: 'UNSEEN',
    maxResults: 5
  },
  mapper: {},
  metadata: {
    designer: designer(0, 0, 'Watch Emails'),
    restore: {
      parameters: {
        __IMTCONN__: { label: "ROLITO's Microsoft connection" },
        folder: { path: ['INBOX'] },
        criteria: { label: 'Unseen emails' }
      }
    },
    parameters: [
      { name: '__IMTCONN__', type: 'account:azure', label: 'Connection', required: true },
      { name: 'folder', type: 'folder', label: 'Folder', required: true },
      { name: 'criteria', type: 'select', label: 'Criteria', required: true, validate: { enum: ['ALL', 'SEEN', 'UNSEEN'] } },
      { name: 'maxResults', type: 'number', label: 'Maximum number of results' }
    ],
    expect: [
      { name: 'folder', type: 'folder', label: 'Folder', required: true },
      { name: 'criteria', type: 'select', label: 'Criteria', required: true, validate: { enum: ['ALL', 'SEEN', 'UNSEEN'] } },
      { name: 'maxResults', type: 'number', label: 'Maximum number of results' }
    ]
  }
};

const replyMessage = 'ID: {{1.id}}\nAsunto: {{1.subject}}\nDe: {{1.from.name}} <{{1.from.address}}>\nFecha: {{1.receivedDateTime}}\n\n{{1.body.content}}\n\nClasificá esta respuesta, actualizá el lead y prepará un borrador de respuesta para aprobación. Devolvé el informe con el formato indicado.';

const replyBlueprint = {
  name: '03 - Bandeja de Respuestas (Outlook)',
  flow: [
    replyTrigger,
    agentModule({ id: 2, prompt: promReply, message: replyMessage, tools: replyTools, name: 'Analista de Respuestas', x: 300, y: 0 }),
    telegramModule({
      id: 3, x: 750, y: 0,
      text: 'RESPUESTA COMERCIAL - {{formatDate(now; "DD/MM/YYYY HH:mm")}}\n\n{{substring(2.response; 0; 3700)}}'
    })
  ],
  metadata: scenarioMetadata(true)
};

const marketingTools = [
  toolFromModule(
    'Leer configuracion',
    'Devuelve la configuración de la marca, nichos, países, idiomas y prohibiciones.',
    airtableSearch({ id: 10, x: 300, y: 120, name: 'Leer Config', table: T.config, tableLabel: 'Config', fields: configFields, maxRecords: 40 })
  ),
  toolFromModule(
    'Leer catalogo',
    'Devuelve los productos activos con precio, materiales, medidas, lead time y argumentos de venta.',
    airtableSearch({ id: 11, x: 300, y: 260, name: 'Leer Catalogo', table: T.productos, tableLabel: 'Productos', fields: productFields, formula: "{Estado}=\"Activo\"", maxRecords: 10, fieldTypes: productFieldTypes })
  ),
  toolFromModule(
    'Leer contenido previo',
    'Devuelve las piezas de contenido anteriores con plataforma, formato, gancho, estado y métricas. Usala para no repetir y para aprender.',
    airtableSearch({ id: 12, x: 300, y: 400, name: 'Leer Contenido', table: T.contenido, tableLabel: 'Contenido', fields: contentFields, maxRecords: 50, fieldTypes: contentFieldTypes })
  ),
  toolFromModule(
    'Leer metricas',
    'Devuelve las métricas diarias de leads, envíos, respuestas, ventas e ingresos. Usala para ajustar el plan.',
    airtableSearch({ id: 13, x: 300, y: 540, name: 'Leer Metricas', table: T.metricas, tableLabel: 'Metricas', fields: metricsFields, maxRecords: 14, fieldTypes: metricsFieldTypes })
  ),
  toolFromModule(
    'Leer aprendizajes',
    'Devuelve los patrones comerciales validados. Usalos para elegir ángulos y nichos.',
    airtableSearch({ id: 14, x: 300, y: 680, name: 'Leer Aprendizajes', table: T.aprendizajes, tableLabel: 'Aprendizajes', fields: learningFields, maxRecords: 20 })
  ),
  toolFromModule(
    'Guardar pieza de contenido',
    'Guarda una pieza de contenido en Airtable con Estado = En_revision. Usala una vez por pieza. No publica nada.',
    airtableCreate({
      id: 15, x: 300, y: 820, name: 'Guardar Contenido', table: T.contenido, tableLabel: 'Contenido',
      recordSpec: [
        { name: 'Titulo', type: 'text', label: 'Título' },
        { name: 'Plataforma', type: 'text', label: 'Plataforma' },
        { name: 'Formato', type: 'text', label: 'Formato' },
        { name: 'Gancho', type: 'text', label: 'Gancho' },
        { name: 'Copy', type: 'text', label: 'Copy' },
        { name: 'Hashtags', type: 'text', label: 'Hashtags' },
        { name: 'CTA', type: 'text', label: 'CTA' },
        { name: 'Producto', type: 'text', label: 'Producto' },
        { name: 'Estado', type: 'text', label: 'Estado' },
        { name: 'Fecha_publicacion', type: 'date', label: 'Fecha de publicación' }
      ],
      aiInstructions: {
        Titulo: { help: 'Título interno.', instruction: 'Nombre corto para identificar la pieza.' },
        Plataforma: { help: 'Plataforma.', instruction: 'Instagram, TikTok, Pinterest, LinkedIn, Facebook, YouTube, Blog o Email.' },
        Formato: { help: 'Formato.', instruction: 'Reel, Carrusel, Foto, Historia, Post, Video, Articulo o Newsletter.' },
        Gancho: { help: 'Gancho.', instruction: 'Primera frase o primera imagen. Debe detener el scroll y ser específico.' },
        Copy: { help: 'Copy.', instruction: 'Texto completo listo para publicar. Sin placeholders.' },
        Hashtags: { help: 'Hashtags.', instruction: 'Máximo 12, relevantes, sin spam.' },
        CTA: { help: 'CTA.', instruction: 'Una sola acción concreta.' },
        Producto: { help: 'Producto.', instruction: 'Nombre exacto de un producto activo.' },
        Estado: { help: 'Estado.', instruction: 'Usá En_revision.' },
        Fecha_publicacion: { help: 'Fecha ISO.', instruction: 'Fecha planificada de publicación en formato YYYY-MM-DD.' }
      },
      fieldTypes: contentFieldTypes
    })
  )
];

const marketingMessage = 'Generá el plan de contenido para la semana que empieza el {{formatDate(now; "YYYY-MM-DD")}}. Leé Config, catálogo, contenido previo, métricas y aprendizajes. Creá entre 3 y 6 piezas en Contenido con Estado = En_revision. No publiques. Devolvé el informe con el calendario y el experimento de la semana.';

const marketingBlueprint = {
  name: '04 - Marketing de Contenido (Borradores)',
  flow: [
    agentModule({ id: 1, prompt: promMarketing, message: marketingMessage, tools: marketingTools, name: 'Director de Marketing', x: 0, y: 0 }),
    telegramModule({
      id: 2, x: 450, y: 0,
      text: 'PLAN DE CONTENIDO - {{formatDate(now; "DD/MM/YYYY")}}\n\n{{substring(1.response; 0; 3700)}}'
    })
  ],
  metadata: scenarioMetadata(false)
};

const outputs = [
  ['01-motor-comercial.blueprint.json', salesBlueprint],
  ['02-envio-aprobado.blueprint.json', sendBlueprint],
  ['03-bandeja-respuestas.blueprint.json', replyBlueprint],
  ['04-marketing-contenido.blueprint.json', marketingBlueprint]
];

for (const [filename, blueprint] of outputs) {
  await writeFile(path.join(ROOT, filename), JSON.stringify(blueprint, null, 4), 'utf8');
  console.log('Generated', filename);
}

const manifest = {
  generatedAt: new Date().toISOString(),
  basePlaceholder: BASE,
  tablePlaceholders: T,
  scenarios: outputs.map(([filename]) => filename)
};
await writeFile(path.join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
console.log('Generated manifest.json');
