import { useEffect, useState, type ReactNode, type SubmitEvent } from 'react';
import { Direction } from 'radix-ui';
import { ChevronDown, Copy, FolderOpen, MessageSquareText, Moon, PenLine, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Spinner } from '@/components/ui/spinner';
import { useConversation } from './use-conversation.ts';
import { aboutParagraphs } from './about.ts';

type Translate = (fa: string, en: string) => string;
function Disclosure({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Collapsible id={id} open={open} onOpenChange={setOpen}>
    <CollapsibleTrigger asChild><Button id={`${id}-trigger`} variant="ghost" size="compact" className="disclosure-trigger">
      <span>{title}</span><ChevronDown data-icon="inline-end" className="shrink-0 transition-transform in-data-[state=open]:rotate-180" />
    </Button></CollapsibleTrigger>
    <CollapsibleContent forceMount hidden={!open}><div className="disclosure-content">{children}</div></CollapsibleContent>
  </Collapsible>;
}
function PasswordField({ id, t, showing, toggle, onInput, invalid, action, children }: {
  id: 'setup' | 'unlock'; t: Translate; showing: boolean; toggle: () => void; onInput: () => void; invalid: boolean; action?: ReactNode; children: ReactNode;
}) {
  return <Field data-invalid={invalid}>
    <div className="field-heading"><FieldLabel htmlFor={`${id}-passphrase`}>{t('عبارت رمز', 'Passphrase')}</FieldLabel>{action}</div>
    <InputGroup className="password-field">
      <InputGroupInput id={`${id}-passphrase`} type={showing ? 'text' : 'password'} dir="auto" maxLength={1024} autoComplete="off" spellCheck={false} autoCapitalize="off" aria-invalid={invalid} aria-describedby={id === 'setup' ? 'passphrase-hint' : 'unlock-hint'} onInput={onInput} />
      <InputGroupAddon align="inline-end"><Button id={`${id}-show`} size="field" variant="ghost" type="button" aria-controls={`${id}-passphrase`} aria-pressed={showing} onClick={toggle}>{showing ? t('پنهان', 'Hide') : t('نمایش', 'Show')}</Button></InputGroupAddon>
    </InputGroup>
    {children}
  </Field>;
}
function Heading({ id, children }: { id: string; children: ReactNode }) {
  return <h2 className="task-title" id={id} tabIndex={-1}>{children}</h2>;
}

export function App({ pristine }: { pristine: string }) {
  const c = useConversation(pristine);
  const [english, setEnglish] = useState(false);
  const [chosenTheme, setChosenTheme] = useState<'light' | 'dark'>();
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = chosenTheme ?? (systemDark ? 'dark' : 'light');
  const t: Translate = (fa, en) => english ? en : fa;
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    document.documentElement.lang = english ? 'en' : 'fa'; document.documentElement.dir = english ? 'ltr' : 'rtl';
    document.documentElement.dataset.theme = theme; document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [english, theme]);
  const keyDisabled = !c.supported || c.busy || c.deriving;
  const inConversation = ['home', 'write', 'cover', 'read', 'message'].includes(c.screen);
  const submit = (action: () => void) => (event: SubmitEvent<HTMLFormElement>) => { event.preventDefault(); action(); };
  const waiting = c.busy ? <Spinner data-icon="inline-start" aria-label={t('در حال انجام', 'Working')} /> : null;
  const composeTitle = c.screen === 'cover' ? ['cover-heading', t('آمادهٔ ارسال', 'Ready to send')]
    : c.screen === 'read' ? ['read-heading', t('خواندن پیام', 'Read a message')]
    : c.screen === 'message' ? ['plain-heading', t('پیام شما', 'Your message')]
    : ['write-heading', t('نوشتن پیام', 'Write a message')];
  const themeLabel = theme === 'dark' ? t('حالت روشن', 'Light mode') : t('حالت تیره', 'Dark mode');
  return <Direction.Provider dir={english ? 'ltr' : 'rtl'}><div className="shell">
    <header className="app-header">
      <div className="brand"><h1>{t('بدو پچ پچ', 'BodoPechPech')}</h1></div>
      <div className="header-actions">
        <Button id="theme" type="button" variant="ghost" size="icon" title={themeLabel} aria-label={theme === 'dark' ? t('تغییر به حالت روشن', 'Switch to light mode') : t('تغییر به حالت تیره', 'Switch to dark mode')} onClick={() => setChosenTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun /> : <Moon />}<span id="theme-label" className="sr-only">{themeLabel}</span>
        </Button>
        <Button id="language" type="button" variant="ghost" size="compact" lang={english ? 'fa' : 'en'} onClick={() => setEnglish(!english)}>{english ? 'فارسی' : 'English'}</Button>
      </div>
    </header>
    <main className="main-flow">
      <p id="capability" role="status" hidden={c.screen !== 'loading'}>{t('در حال باز شدن…', 'Opening…')}</p>
      <section id="setup-panel" hidden={c.screen !== 'setup' && c.screen !== 'download'} aria-labelledby={c.screen === 'download' ? 'download-heading' : 'setup-heading'}>
        <div id="setup-controls" hidden={c.screen !== 'setup'} className="screen">
          <div className="intro"><Heading id="setup-heading">{t('گفت‌وگوی تازه', 'New conversation')}</Heading><p>{t('یک فایل، برای شما و نفر دوم.', 'One file for you and someone you trust.')}</p></div>
          <form id="setup-form" autoComplete="off" onSubmit={submit(() => c.prepareFile(false))}><FieldGroup>
            <PasswordField id="setup" t={t} showing={c.showSetup} toggle={() => c.setShowSetup(!c.showSetup)} onInput={c.changed} invalid={c.invalid === 'setup'} action={<Button id="generate-passphrase" variant="ghost" size="compact" type="button" disabled={!c.supported} onClick={c.generate}>{t('ساخت خودکار', 'Generate')}</Button>}>
              <FieldDescription id="passphrase-hint">{t('۸ نویسه یا بیشتر، یک عدد و یک نماد مثل !. رمز را نگه دارید؛ بازنشانی ندارد.', '8+ characters, a number and a symbol like !. Keep it safe; there is no reset.')}</FieldDescription>
            </PasswordField>
            <Button id="generate" type="submit" disabled={keyDisabled}>{waiting}{t('ساخت و ذخیرهٔ فایل', 'Save conversation file')}</Button>
          </FieldGroup></form>
          <p className="sharing-note">{t('همین فایل را خصوصی بفرستید. عبارت رمز را جداگانه برسانید.', 'Share the same file privately. Send its passphrase separately.')}</p>
          <div className="saved-file-option"><Disclosure id="open-saved" title={t('باز کردن گفت‌وگوی ذخیره‌شده', 'Open saved conversation')}>
            <form id="open-file-form" autoComplete="off" onSubmit={submit(c.openFile)}><FieldGroup>
              <Field><FieldLabel htmlFor="saved-file">{t('فایل HTML خصوصی', 'Private HTML file')}</FieldLabel><Input id="saved-file" type="file" accept=".html,text/html" onInput={c.changed} /><FieldDescription>{t('روی همین دستگاه خوانده می‌شود. چیزی ارسال یا تغییر نمی‌کند.', 'Read on this device. Nothing is uploaded or changed.')}</FieldDescription></Field>
              <Button id="open-file" type="submit" disabled={keyDisabled}>{waiting || <FolderOpen data-icon="inline-start" />}{t('باز کردن گفت‌وگو', 'Open conversation')}</Button>
            </FieldGroup></form>
          </Disclosure></div>
        </div>
        <div id="download-panel" hidden={c.screen !== 'download'} className="screen">
          <Heading id="download-heading">{t('فایل شما آماده است', 'Your file is ready')}</Heading>
          <div className="download-copy"><p>{t('یک نسخه را نگه دارید و همین فایل را خصوصی به نفر دوم بدهید.', 'Keep a copy and give this same file privately to the other person.')}</p><p>{t('عبارت رمز را جداگانه برسانید. برای نفر دوم فایل تازه‌ای نسازید.', 'Share the passphrase separately. Do not create a different file for them.')}</p></div>
          <Button asChild><a id="download">{t('ذخیرهٔ دوبارهٔ فایل', 'Save the file again')}</a></Button>
          <p className="sharing-note">{t('اگر دانلود شروع نشد، دکمهٔ بالا را بزنید.', 'If the download did not start, use the button above.')}</p>
          <Disclosure id="opening-help" title={t('فایل باز نمی‌شود؟', 'Trouble opening the file?')}><p className="helper-copy">{t('در ویندوز، فایل اولیه را در Chrome یا Edge باز کنید و «باز کردن گفت‌وگوی ذخیره‌شده» را بزنید. پیش‌نمایش پیوست در iPhone و iPad پشتیبانی نمی‌شود.', 'In Windows, open the starter in Chrome or Edge and choose Open saved conversation. iPhone and iPad attachment previews are not supported.')}</p></Disclosure>
        </div>
      </section>
      <section id="unlock-panel" hidden={c.screen !== 'unlock'} aria-labelledby="unlock-heading" className="screen">
        <div className="intro"><Heading id="unlock-heading">{t('باز کردن گفت‌وگو', 'Unlock conversation')}</Heading></div>
        <form id="unlock-form" autoComplete="off" onSubmit={submit(c.unlock)}><FieldGroup>
          <PasswordField id="unlock" t={t} showing={c.showUnlock} toggle={() => c.setShowUnlock(!c.showUnlock)} onInput={c.changed} invalid={c.invalid === 'unlock'}><FieldDescription id="unlock-hint">{t('تا وقتی این زبانه باز است، یک بار کافی است.', 'Only once while this tab stays open.')}</FieldDescription></PasswordField>
          <Button id="unlock" type="submit" disabled={keyDisabled}>{waiting}{t('باز کردن', 'Unlock')}</Button>
        </FieldGroup></form>
      </section>
      <section id="conversation" hidden={!inConversation} aria-label={t('گفت‌وگو', 'Conversation')}>
        <div id="home" hidden={c.screen !== 'home'} className="screen home-screen">
          <Heading id="home-heading">{t('نوشتن یا خواندن؟', 'Write or read?')}</Heading>
          <div className="home-actions"><Button id="send-mode" size="choice" type="button" onClick={() => c.mode(false)}><PenLine data-icon="inline-start" /><span>{t('نوشتن پیام', 'Write a message')}</span></Button><Button id="receive-mode" variant="secondary" size="choice" type="button" onClick={() => c.mode(true)}><MessageSquareText data-icon="inline-start" /><span>{t('خواندن پیام', 'Read a message')}</span></Button></div>
        </div>
        <div id="message-screen" hidden={!inConversation || c.screen === 'home'} className="screen">
          <div className="compose-heading"><Heading id={composeTitle[0]!}>{composeTitle[1]}</Heading><Button id="clear" type="button" variant="ghost" size="compact" aria-label={t('تمام شد؛ پاک کردن پیام‌ها', 'Done; clear messages')} onClick={() => c.home()}>{t('تمام شد', 'Done')}</Button></div>
          <div id="send-panel" hidden={c.screen !== 'write' && c.screen !== 'cover'}>
            <form id="send-form" hidden={c.screen !== 'write'} autoComplete="off" onSubmit={submit(c.encrypt)}><FieldGroup>
              <Field data-invalid={c.invalid === 'message'}><FieldLabel htmlFor="message" className="sr-only">{t('پیام شما', 'Your message')}</FieldLabel><Textarea id="message" rows={7} dir="auto" spellCheck={false} autoComplete="off" maxLength={4096} aria-invalid={c.invalid === 'message'} onInput={() => c.edit(false)} /><FieldDescription>{t('پیام کوتاه راحت‌تر فرستاده می‌شود.', 'A short message is easier to send.')}</FieldDescription></Field>
              <Button id="encrypt" type="submit" disabled={c.busy}>{waiting}{t('آماده کردن پیام', 'Prepare message')}</Button>
            </FieldGroup></form>
            <section id="cover-result" hidden={c.screen !== 'cover'} aria-labelledby="cover-heading" className="screen">
              <p className="helper-copy">{t('همهٔ متن را بدون تغییر در پیام‌رسان بفرستید. ممکن است غیرعادی به نظر برسد.', 'Send all of the text without changes. It may sound unusual.')}</p>
              <Textarea id="cover" lang="fa" dir="rtl" readOnly rows={7} aria-label="متن آمادهٔ ارسال / Text to send" spellCheck={false} autoComplete="off" />
              <Button id="copy-cover" type="button" disabled={c.busy} onClick={() => void c.copy('cover')}><Copy data-icon="inline-start" />{t('کپی کردن متن', 'Copy text')}</Button>
              <div className="secondary-actions"><Button id="edit-message" type="button" variant="ghost" size="compact" onClick={() => c.mode(false)}>{t('ویرایش', 'Edit')}</Button><Button id="new-message" type="button" variant="ghost" size="compact" onClick={() => c.fresh(false)}>{t('پیام تازه', 'New message')}</Button></div>
            </section>
          </div>
          <div id="receive-panel" hidden={c.screen !== 'read' && c.screen !== 'message'}>
            <form id="receive-form" hidden={c.screen !== 'read'} autoComplete="off" onSubmit={submit(c.decrypt)}><FieldGroup>
              <Field data-invalid={c.invalid === 'received'}><FieldLabel htmlFor="received" className="sr-only">{t('متن دریافتی', 'Received text')}</FieldLabel><Textarea id="received" rows={7} lang="fa" dir="rtl" placeholder={t('همهٔ متن دریافتی را اینجا بچسبانید.', 'Paste the complete received text here.')} maxLength={180000} spellCheck={false} autoComplete="off" aria-invalid={c.invalid === 'received'} onInput={() => c.edit(true)} /></Field>
              <div className="read-actions"><Button id="paste-cover" type="button" variant="secondary" disabled={c.busy} onClick={() => void c.paste()}>{t('چسباندن', 'Paste')}</Button><Button id="decrypt" type="submit" disabled={c.busy}>{waiting}{t('خواندن پیام', 'Read message')}</Button></div>
            </FieldGroup></form>
            <section id="plain-result" hidden={c.screen !== 'message'} aria-labelledby="plain-heading" className="screen">
              <pre id="plaintext" dir="auto" tabIndex={0} className="message-output" />
              <Button id="reply" type="button" disabled={c.busy} onClick={c.reply}>{t('نوشتن پاسخ', 'Write a reply')}</Button>
              <div className="secondary-actions"><Button id="copy-plain" type="button" variant="ghost" size="compact" disabled={c.busy} onClick={() => void c.copy('plaintext')}>{t('کپی کردن', 'Copy message')}</Button><Button id="read-another" type="button" variant="ghost" size="compact" onClick={() => c.fresh(true)}>{t('خواندن پیام دیگر', 'Read another')}</Button></div>
            </section>
          </div>
        </div>
      </section>
      <Alert id="feedback" role="status" aria-live="polite" hidden={!c.status[0]}><AlertDescription>{t(...c.status)}</AlertDescription></Alert>
      <Alert id="error" variant="destructive" role="alert" tabIndex={-1} hidden={!c.error[0]}><AlertDescription>{t(...c.error)}</AlertDescription></Alert>
    </main>
    <footer className="app-footer"><Disclosure id="about" title={t('درباره', 'About')}><div className="about-copy">
      <div hidden={c.screen !== 'setup'}><Disclosure id="legacy-setup" title={t('محافظت از گفت‌وگوی قبلی', 'Protect an older conversation')}><form id="import-form" autoComplete="off" onSubmit={submit(() => c.prepareFile(true))}><FieldGroup>
        <Field><FieldLabel htmlFor="import-file">{t('فایل HTML خصوصی قبلی', 'Old private HTML file')}</FieldLabel><Input id="import-file" type="file" accept=".html,text/html" onInput={c.changed} /></Field>
        <Field><FieldLabel htmlFor="import-code">{t('یا کد قبلی را بچسبانید', 'Or paste the old setup code')}</FieldLabel><Input id="import-code" type="password" dir="ltr" maxLength={256} autoComplete="off" spellCheck={false} autoCapitalize="off" onInput={c.changed} /><FieldDescription>{t('عبارت رمز را در بالای صفحه انتخاب کنید. گفت‌وگوی فعلی حفظ می‌شود. نسخه‌های قبلیِ بدون محافظت هنوز کار می‌کنند؛ امن نگه دارید یا حذف کنید. این کار آن‌ها را باطل نمی‌کند.', 'Choose a passphrase at the top of the page. This keeps your conversation. Old unprotected copies still work; keep them safe or delete them. This cannot revoke them.')}</FieldDescription></Field>
        <Button id="import" type="submit" disabled={keyDisabled}>{waiting}{t('ذخیرهٔ نسخهٔ محافظت‌شده', 'Save a protected copy')}</Button>
      </FieldGroup></form></Disclosure></div>
      {aboutParagraphs.map((words, i) => <p key={i}>{t(...words)}</p>)}
      <p>{t('بدو پچ پچ · نسخهٔ ۰.۵.۰ · خواندن پیام‌های نسخهٔ ۱ و ۲', 'BodoPechPech · 0.5.0 · Reads message formats v1 + v2')}</p>
    </div></Disclosure></footer>
  </div></Direction.Provider>;
}
