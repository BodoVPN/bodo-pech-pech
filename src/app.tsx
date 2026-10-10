import { useEffect, useState, type ReactNode, type SubmitEvent } from 'react';
import { Direction } from 'radix-ui';
import { ArrowDownToLine, ArrowUpRight, Check, ChevronDown, Clipboard, Copy, FileKey2, FolderOpen, LockKeyhole, MessageSquareText, Moon, PenLine, RefreshCw, ShieldCheck, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { useConversation } from './use-conversation.ts';
import { aboutParagraphs } from './about.ts';

type Translate = (fa: string, en: string) => string;
function Disclosure({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Collapsible id={id} open={open} onOpenChange={setOpen}>
    <CollapsibleTrigger asChild><Button id={`${id}-trigger`} variant="ghost" className="w-full justify-between">
      <span>{title}</span><ChevronDown data-icon="inline-end" className="shrink-0 transition-transform in-data-[state=open]:rotate-180" />
    </Button></CollapsibleTrigger>
    <CollapsibleContent forceMount hidden={!open}><div className="pt-4">{children}</div></CollapsibleContent>
  </Collapsible>;
}
function PasswordField({ id, t, showing, toggle, onInput, invalid, children }: {
  id: 'setup' | 'unlock'; t: Translate; showing: boolean; toggle: () => void; onInput: () => void; invalid: boolean; children: ReactNode;
}) {
  return <Field data-invalid={invalid}>
    <FieldLabel htmlFor={`${id}-passphrase`}>{id === 'setup' ? t('یک عبارت رمز انتخاب کنید', 'Choose a passphrase') : t('عبارت رمز', 'Passphrase')}</FieldLabel>
    <InputGroup className="password-field">
      <InputGroupInput id={`${id}-passphrase`} type={showing ? 'text' : 'password'} dir="auto" maxLength={1024} autoComplete="off" spellCheck={false} autoCapitalize="off" aria-invalid={invalid} aria-describedby={id === 'setup' ? 'passphrase-hint' : 'unlock-hint'} onInput={onInput} />
      <InputGroupAddon align="inline-end"><Button id={`${id}-show`} size="field" variant="ghost" type="button" aria-controls={`${id}-passphrase`} aria-pressed={showing} onClick={toggle}>{showing ? t('پنهان', 'Hide') : t('نمایش', 'Show')}</Button></InputGroupAddon>
    </InputGroup>
    {children}
  </Field>;
}
function Heading({ id, title, description, icon }: { id: string; title: string; description?: string; icon: ReactNode }) {
  return <CardHeader><div className="step-icon" aria-hidden="true">{icon}</div><CardTitle><h2 id={id} tabIndex={-1}>{title}</h2></CardTitle>{description && <CardDescription>{description}</CardDescription>}</CardHeader>;
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
  return <Direction.Provider dir={english ? 'ltr' : 'rtl'}><div className="shell">
    <header className="app-header">
      <div className="brand"><MessageSquareText className="brand-mark" aria-hidden="true" /><h1>{t('بدو پچ پچ', 'BodoPechPech')}</h1></div>
      <div className="header-actions"><Button id="theme" type="button" variant="ghost" size="sm" aria-label={theme === 'dark' ? t('تغییر به حالت روشن', 'Switch to light mode') : t('تغییر به حالت تیره', 'Switch to dark mode')} onClick={() => setChosenTheme(theme === 'dark' ? 'light' : 'dark')}>
        {theme === 'dark' ? <Sun data-icon="inline-start" /> : <Moon data-icon="inline-start" />}<span id="theme-label">{theme === 'dark' ? t('حالت روشن', 'Light mode') : t('حالت تیره', 'Dark mode')}</span>
      </Button><Button id="language" type="button" variant="outline" size="sm" lang={english ? 'fa' : 'en'} onClick={() => setEnglish(!english)}>{english ? 'فارسی' : 'English'}</Button></div>
    </header>
    <main className="main-flow">
      <p id="capability" role="status" hidden={c.screen !== 'loading'}>{t('در حال باز شدن…', 'Opening…')}</p>
      <section id="setup-panel" hidden={c.screen !== 'setup' && c.screen !== 'download'} aria-labelledby={c.screen === 'download' ? 'download-heading' : 'setup-heading'}>
        <Card id="setup-controls" hidden={c.screen !== 'setup'}>
          <Heading id="setup-heading" icon={<FileKey2 />} title={t('یک گفت‌وگوی خصوصی بسازید', 'Start a private conversation')} description={t('یک فایل برای شما و نفر دوم. یک بار بسازید و هر وقت خواستید از آن استفاده کنید.', 'One file for you and the other person. Make it once. Use it whenever you need.')} />
          <CardContent className="flex flex-col gap-6"><form id="setup-form" autoComplete="off" onSubmit={submit(() => c.prepareFile(false))}><FieldGroup>
            <PasswordField id="setup" t={t} showing={c.showSetup} toggle={() => c.setShowSetup(!c.showSetup)} onInput={c.changed} invalid={c.invalid === 'setup'}>
              <FieldDescription id="passphrase-hint">{t('دست‌کم ۸ نویسه، یک عدد و یک نماد مثل !. امن نگه دارید؛ بازنشانی ندارد.', 'At least 8 characters, one number and one symbol like !. Keep it safe; there is no reset.')}</FieldDescription>
              <Button id="generate-passphrase" variant="secondary" className="w-fit" type="button" disabled={!c.supported} onClick={c.generate}><RefreshCw data-icon="inline-start" />{t('ساخت خودکار', 'Generate')}</Button>
            </PasswordField>
            <Button id="generate" type="submit" className="w-full" disabled={keyDisabled}>{waiting || <ArrowDownToLine data-icon="inline-start" />}{t('ساخت و ذخیرهٔ فایل گفت‌وگو', 'Make & save conversation file')}</Button>
          </FieldGroup></form><FieldDescription>{t('همان فایل را خصوصی به نفر دوم بدهید. عبارت رمز را جداگانه برسانید.', 'Give the same file privately to the other person. Share the passphrase separately.')}</FieldDescription></CardContent>
          <CardFooter className="flex-col items-stretch gap-2">
            <Disclosure id="open-saved" title={t('باز کردن گفت‌وگوی ذخیره‌شده', 'Open saved conversation')}><form id="open-file-form" autoComplete="off" onSubmit={submit(c.openFile)}><FieldGroup>
              <Field><FieldLabel htmlFor="saved-file">{t('فایل HTML خصوصی خود را انتخاب کنید', 'Choose your private HTML file')}</FieldLabel><Input id="saved-file" type="file" accept=".html,text/html" onInput={c.changed} /><FieldDescription>{t('روی همین دستگاه خوانده می‌شود؛ سپس عبارت رمز فعلی را وارد کنید. چیزی ارسال یا تغییر نمی‌کند.', 'Read locally, then unlock with its existing passphrase. Nothing is uploaded or changed.')}</FieldDescription></Field>
              <Button id="open-file" type="submit" variant="outline" disabled={keyDisabled}>{waiting || <FolderOpen data-icon="inline-start" />}{t('باز کردن گفت‌وگو', 'Open conversation')}</Button>
            </FieldGroup></form></Disclosure>
            <Separator />
            <Disclosure id="legacy-setup" title={t('محافظت از گفت‌وگوی قبلی', 'Protect an older conversation')}><form id="import-form" autoComplete="off" onSubmit={submit(() => c.prepareFile(true))}><FieldGroup>
              <Field><FieldLabel htmlFor="import-file">{t('فایل HTML خصوصی قبلی را انتخاب کنید', 'Choose the old private HTML file')}</FieldLabel><Input id="import-file" type="file" accept=".html,text/html" onInput={c.changed} /></Field>
              <Field><FieldLabel htmlFor="import-code">{t('یا کد قبلی را بچسبانید', 'Or paste the old setup code')}</FieldLabel><Input id="import-code" type="password" dir="ltr" maxLength={256} autoComplete="off" spellCheck={false} autoCapitalize="off" onInput={c.changed} /><FieldDescription>{t('از عبارت رمز بالا استفاده می‌شود و گفت‌وگوی فعلی حفظ می‌شود. نسخه‌های قبلیِ بدون محافظت هنوز کار می‌کنند؛ آن‌ها را امن نگه دارید یا حذف کنید. این کار آن‌ها را باطل نمی‌کند.', 'Uses the passphrase above and keeps your existing conversation. Old unprotected copies still work; keep them safe or delete them. This cannot revoke them.')}</FieldDescription></Field>
              <Button id="import" type="submit" disabled={keyDisabled}>{waiting}{t('ذخیرهٔ نسخهٔ محافظت‌شده', 'Save a protected copy')}</Button>
            </FieldGroup></form></Disclosure>
          </CardFooter>
        </Card>
        <Card id="download-panel" hidden={c.screen !== 'download'}>
          <Heading id="download-heading" icon={<Check />} title={t('فایل خصوصی شما آماده است', 'Your private file is ready')} description={t('فایل را نگه دارید. هر بار آن را باز کردید، عبارت رمز را وارد کنید.', 'Keep the file. Enter your passphrase whenever you open it.')} />
          <CardContent className="flex flex-col gap-5"><Alert><ShieldCheck /><AlertTitle>{t('یک فایل، برای هر دو نفر', 'The same file for both of you')}</AlertTitle><AlertDescription>{t('همین فایل را خصوصی به نفر دوم بدهید و عبارت رمز را جداگانه برسانید. برای نفر دوم فایل تازه‌ای نسازید.', 'Give this file privately to the other person and share the passphrase separately. Do not create a different file for them.')}</AlertDescription></Alert>
            <Button asChild><a id="download"><ArrowDownToLine data-icon="inline-start" />{t('ذخیرهٔ دوبارهٔ فایل', 'Save the file again')}</a></Button><FieldDescription>{t('اگر دانلود شروع نشد، دکمهٔ بالا را بزنید.', 'If no download appeared, use the button above.')}</FieldDescription>
          </CardContent><CardFooter><FieldDescription>{t('ویندوز فایل را باز نمی‌کند؟ فایل اولیه را در Chrome یا Edge باز کنید و «باز کردن گفت‌وگوی ذخیره‌شده» را بزنید. پیش‌نمایش پیوست در iPhone و iPad پشتیبانی نمی‌شود.', 'Windows blocks the file? Open the starter in Chrome or Edge and choose Open saved conversation. iPhone and iPad attachment previews are not supported.')}</FieldDescription></CardFooter>
        </Card>
      </section>
      <Card id="unlock-panel" hidden={c.screen !== 'unlock'} aria-labelledby="unlock-heading">
        <Heading id="unlock-heading" icon={<LockKeyhole />} title={t('گفت‌وگوی خود را باز کنید', 'Open your conversation')} description={t('عبارت رمز این فایل را وارد کنید.', 'Enter the passphrase for this file.')} />
        <CardContent><form id="unlock-form" autoComplete="off" onSubmit={submit(c.unlock)}><FieldGroup>
          <PasswordField id="unlock" t={t} showing={c.showUnlock} toggle={() => c.setShowUnlock(!c.showUnlock)} onInput={c.changed} invalid={c.invalid === 'unlock'}><FieldDescription id="unlock-hint">{t('تا وقتی این زبانه باز است، یک بار کافی است. می‌توانید به پیام‌رسان بروید و برگردید.', 'Unlock once while this tab stays open. You can switch to your messenger and come back.')}</FieldDescription></PasswordField>
          <Button id="unlock" type="submit" disabled={keyDisabled}>{waiting || <LockKeyhole data-icon="inline-start" />}{t('باز کردن', 'Unlock')}</Button>
        </FieldGroup></form></CardContent><CardFooter><FieldDescription>{t('عبارت رمز فقط روی همین دستگاه استفاده می‌شود.', 'Your passphrase is used only on this device.')}</FieldDescription></CardFooter>
      </Card>
      <section id="conversation" hidden={!inConversation} aria-label={t('گفت‌وگو', 'Conversation')}>
        <Card id="home" hidden={c.screen !== 'home'}>
          <Heading id="home-heading" icon={<MessageSquareText />} title={t('می‌خواهید چه کار کنید؟', 'What would you like to do?')} description={t('گفت‌وگوی شما باز است.', 'Your conversation is unlocked.')} />
          <CardContent className="grid gap-3"><Button id="send-mode" size="choice" type="button" onClick={() => c.mode(false)}><PenLine data-icon="inline-start" /><span>{t('نوشتن پیام', 'Write a message')}</span></Button><Button id="receive-mode" variant="outline" size="choice" type="button" onClick={() => c.mode(true)}><MessageSquareText data-icon="inline-start" /><span>{t('خواندن پیام', 'Read a message')}</span></Button></CardContent>
          <CardFooter><FieldDescription>{t('این فایل خصوصی را نگه دارید. هر وقت خواستید، دوباره بازش کنید.', 'Keep this private file. Open it again whenever you need it.')}</FieldDescription></CardFooter>
        </Card>
        <div id="message-screen" hidden={!inConversation || c.screen === 'home'} className="flex flex-col gap-4">
          <Button id="clear" type="button" variant="ghost" className="w-fit" onClick={() => c.home()}><Check data-icon="inline-start" />{t('تمام شد · پاک کردن پیام‌ها', 'Done · clear messages')}</Button>
          <div id="send-panel" hidden={c.screen !== 'write' && c.screen !== 'cover'}>
            <Card id="send-form" hidden={c.screen !== 'write'}>
              <Heading id="write-heading" icon={<PenLine />} title={t('چه می‌خواهید بگویید؟', 'What do you want to say?')} description={t('پیام کوتاه راحت‌تر فرستاده می‌شود.', 'A short message is easier to send.')} />
              <CardContent><form autoComplete="off" onSubmit={submit(c.encrypt)}><FieldGroup><Field data-invalid={c.invalid === 'message'}><FieldLabel htmlFor="message">{t('پیام شما', 'Your message')}</FieldLabel><Textarea id="message" rows={5} dir="auto" spellCheck={false} autoComplete="off" maxLength={4096} aria-invalid={c.invalid === 'message'} onInput={() => c.edit(false)} /></Field><Button id="encrypt" type="submit" disabled={c.busy}>{waiting || <ArrowUpRight data-icon="inline-start" />}{t('آماده کردن پیام', 'Prepare message')}</Button></FieldGroup></form></CardContent>
              <CardFooter><FieldDescription>{t('فقط متن آماده‌شده را در پیام‌رسان بفرستید.', 'Send only the prepared text in your messenger.')}</FieldDescription></CardFooter>
            </Card>
            <Card id="cover-result" hidden={c.screen !== 'cover'} aria-labelledby="cover-heading">
              <Heading id="cover-heading" icon={<Copy />} title={t('این متن را در پیام‌رسان بفرستید', 'Copy this into your messenger')} description={t('همهٔ متن را بدون تغییر کلمات بفرستید. ممکن است غیرعادی به نظر برسد.', 'Send all of it, without changing the words. It may sound unusual.')} />
              <CardContent className="flex flex-col gap-5"><Textarea id="cover" lang="fa" dir="rtl" readOnly rows={6} aria-label="متن آمادهٔ ارسال / Text to send" spellCheck={false} autoComplete="off" /><Button id="copy-cover" type="button" disabled={c.busy} onClick={() => void c.copy('cover')}><Copy data-icon="inline-start" />{t('کپی کردن متن', 'Copy text')}</Button></CardContent>
              <CardFooter className="flex-wrap gap-2"><Button id="edit-message" type="button" variant="ghost" onClick={() => c.mode(false)}>{t('ویرایش پیام من', 'Edit my message')}</Button><Button id="new-message" type="button" variant="ghost" onClick={() => c.fresh(false)}>{t('پیام تازه', 'New message')}</Button></CardFooter>
            </Card>
          </div>
          <div id="receive-panel" hidden={c.screen !== 'read' && c.screen !== 'message'}>
            <Card id="receive-form" hidden={c.screen !== 'read'}>
              <Heading id="read-heading" icon={<Clipboard />} title={t('پیام دریافتی را اینجا بیاورید', 'Bring the message here')} description={t('همهٔ پیام را از پیام‌رسان کپی کنید، سپس اینجا بچسبانید.', 'Copy the entire message from your messenger, then paste it here.')} />
              <CardContent><form autoComplete="off" onSubmit={submit(c.decrypt)}><FieldGroup><Field data-invalid={c.invalid === 'received'}><FieldLabel htmlFor="received">{t('متن دریافتی', 'Received text')}</FieldLabel><Textarea id="received" rows={6} lang="fa" dir="rtl" maxLength={180000} spellCheck={false} autoComplete="off" aria-invalid={c.invalid === 'received'} onInput={() => c.edit(true)} /><Button id="paste-cover" type="button" variant="secondary" className="w-fit" disabled={c.busy} onClick={() => void c.paste()}><Clipboard data-icon="inline-start" />{t('چسباندن متن', 'Paste text')}</Button></Field><Button id="decrypt" type="submit" disabled={c.busy}>{waiting || <MessageSquareText data-icon="inline-start" />}{t('خواندن پیام', 'Read message')}</Button></FieldGroup></form></CardContent>
              <CardFooter><FieldDescription>{t('فایل هر دو نفر باید برای یک گفت‌وگو باشد.', 'Both people must use the file for the same conversation.')}</FieldDescription></CardFooter>
            </Card>
            <Card id="plain-result" hidden={c.screen !== 'message'} aria-labelledby="plain-heading">
              <Heading id="plain-heading" icon={<MessageSquareText />} title={t('پیام شما', 'Your message')} />
              <CardContent className="flex flex-col gap-5"><pre id="plaintext" dir="auto" tabIndex={0} className="message-output" /><Button id="reply" type="button" disabled={c.busy} onClick={c.reply}><PenLine data-icon="inline-start" />{t('نوشتن پاسخ', 'Write a reply')}</Button></CardContent>
              <CardFooter className="flex-wrap gap-2"><Button id="copy-plain" type="button" variant="ghost" disabled={c.busy} onClick={() => void c.copy('plaintext')}>{t('کپی کردن این پیام', 'Copy this message')}</Button><Button id="read-another" type="button" variant="ghost" onClick={() => c.fresh(true)}>{t('خواندن پیام دیگر', 'Read another message')}</Button></CardFooter>
            </Card>
          </div>
        </div>
      </section>
      <Alert id="feedback" role="status" aria-live="polite" hidden={!c.status[0]}><Check /><AlertDescription>{t(...c.status)}</AlertDescription></Alert>
      <Alert id="error" variant="destructive" role="alert" tabIndex={-1} hidden={!c.error[0]}><AlertTitle>{t('دوباره بررسی کنید', 'Please check')}</AlertTitle><AlertDescription>{t(...c.error)}</AlertDescription></Alert>
    </main>
    <footer className="app-footer"><div className="local-note"><ShieldCheck aria-hidden="true" /><span>{t('روی همین دستگاه · بدون نیاز به اینترنت', 'On this device · Works offline')}</span></div>
      <Disclosure id="about" title={t('دربارهٔ این فایل خصوصی', 'About this private file')}><div className="about-copy">{aboutParagraphs.map((words, i) => <p key={i}>{t(...words)}</p>)}</div></Disclosure>
      <p className="version">{t('بدو پچ پچ · خواندن نسخه‌های ۱ و ۲', 'BodoPechPech · Reads v1 + v2')}</p>
    </footer>
  </div></Direction.Provider>;
}
