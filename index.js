require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));
app.use('/chat-log.json', express.static(path.join(__dirname, 'chat-log.json')));

function toHtmlWithStepBreaks(text) {
  // If the model already sent <li>, keep it.
  if (/<li>/.test(text)) return text;

  // Put breaks before numbered or dashed steps that were inlined.
  let t = text
    .replace(/(\d+\)\s)/g, '<br>$1')   // 1) ... 2) ...
    .replace(/(^|\s)-\s/g, '<br>- ');  // - bullet

  // Convert remaining newlines to <br>
  t = t.replace(/\n/g, '<br>');
  return t;
}


app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;

  const systemPrompt = `You are “XPS Admin Support” — a fast, factual virtual assistant for XPS Network administrators.

You know the entire **Admin Fundamentals** course, covering setup, structure, communication, content management, reporting, and account settings — everything an admin needs to onboard and manage their organization successfully.

### RULES
- Only answer from the Admin Fundamentals course content.  
- Never invent or guess. If something is missing, say:  
  “That’s something our support team will need to handle — I’ll pass this on right away.”  
  Add: <a href='mailto:support@sidelinesports.com'>support@sidelinesports.com</a>  
- Keep answers short, warm, and direct.  
- Use Australian English.  
- Avoid referring to “the course” or “transcript.”


### FORMAT
When listing steps, output valid HTML using <ol><li>…</li></ol> (no inline “1) … 2) …”). Keep any intro sentence above the list.  
- Include **two line breaks (\n\n)** between steps so Markdown renders cleanly.  
- Use **arrows (→)** for navigation paths, e.g. Settings → Privacy → Terms.  
- Optional: add a short “Tip:” if useful.  

### EXAMPLES
Q: “How do I create an athlete?”
A:
Create a new athlete from User Management.  

1) Go to User Management → Athletes → Register athletes  

2) Choose “Create Single User” or “Create Multiple Users”  

3) Enter name and email, assign Team and Role = Athlete  

4) Send the generated subscription message so they receive their login  

Tip: Bulk add is fastest — paste Name + Email columns from your spreadsheet.

Q: “What if I’m unsure?”
A:
That’s something our support team will need to handle — I’ll pass this on right away.  
<a href='mailto:support@sidelinesports.com'>support@sidelinesports.com</a>

`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    const botReply = response.data.choices[0].message.content;

    const replyHtml = toHtmlWithStepBreaks(botReply);

    const logEntry = {
      timestamp: new Date().toISOString(),
      user: userMessage,
      bot: botReply
    };

    fs.appendFileSync(
      path.join(__dirname, 'chat-log.json'),
      JSON.stringify(logEntry) + '\n',
      'utf8'
    );

    res.json({ reply: botReply, reply_html: replyHtml });

  } catch (error) {
    console.error('OpenAI error:', error.message);
    res.status(500).json({ reply: 'Sorry, something went wrong with the AI server.' });
  }
});

// ✅ Optional health check
app.get('/health', (req, res) => {
  res.send('AI chatbot server is live');
});

app.listen(3001, () => {
  console.log('✅ AI chatbot server is running on http://localhost:3001');
});


