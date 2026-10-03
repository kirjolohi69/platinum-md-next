/* Session-close timing with the real transport + secure layer and a fake USB
 * device/clock. No hardware or real sleeps. SPDX-License-Identifier: LGPL-2.1-or-later */
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include "secure.h"
#include "const.h"
#include "log.h"

typedef struct {
    int request, length, result;
    unsigned int delay_ms;
    unsigned char data[16];
} step;
static step steps[40];
static int count, cursor, commands;
static unsigned char command;
static uint64_t now_ms;
static unsigned int last_timeout;

int clock_gettime(clockid_t clock, struct timespec *out) {
    assert(clock==CLOCK_MONOTONIC);
    out->tv_sec=(time_t)(now_ms/1000);
    out->tv_nsec=(long)((now_ms%1000)*1000000);
    return 0;
}
int usleep(useconds_t micros) { now_ms+=(micros+999)/1000;return 0; }
const char * LIBUSB_CALL libusb_error_name(int code) { (void)code;return "synthetic USB error"; }

int LIBUSB_CALL libusb_control_transfer(libusb_device_handle *dev,uint8_t type,
        uint8_t request,uint16_t value,uint16_t index,unsigned char *data,
        uint16_t length,unsigned int timeout) {
    (void)dev;(void)value;(void)index;
    assert(cursor<count);
    step *s=&steps[cursor++];
    assert(request==s->request && length==s->length);
    last_timeout=timeout;
    if (!(type&LIBUSB_ENDPOINT_IN)) {
        assert(length==12 && data[10]==command);
        commands++;
        assert(commands==1); /* No duplicated close, commit or audio command. */
    }
    if (s->delay_ms>timeout) {
        now_ms+=timeout;
        return LIBUSB_ERROR_TIMEOUT;
    }
    now_ms+=s->delay_ms;
    if ((type&LIBUSB_ENDPOINT_IN) && s->result>0) memcpy(data,s->data,(size_t)s->result);
    return s->result;
}

static void add(int request,int length,int result,unsigned int delay) {
    assert(count<40);
    steps[count++]=(step){request,length,result,delay,{0}};
}
static void reset(unsigned char cmd) {
    memset(steps,0,sizeof(steps));count=cursor=commands=0;now_ms=1000;command=cmd;
    add(1,4,4,0); /* Ready to send. */
    add(0x80,12,12,0); /* The command is accepted by USB exactly once. */
}
static void available(unsigned int delay) {
    add(1,4,4,delay);
    memcpy(steps[count-1].data,(unsigned char[]){1,0x81,12,0},4);
}
static void reply(int size,unsigned int delay) {
    add(0x81,12,size,delay);
    memcpy(steps[count-1].data,(unsigned char[]){0x09,0x18,0,8,0,0x46,0xf0,3,1,3,command,0},12);
}
static void complete(netmd_error expected) {
    netmd_error actual=command==0x81?netmd_secure_leave_session(NULL):netmd_secure_enter_session(NULL);
    assert(actual==expected);
    assert(cursor==count);
}

int main(void) {
    netmd_set_log_level(NETMD_LOG_NONE);
    /* A single poll blocked for five seconds reproduces the one-second bug. */
    reset(0x81);available(5000);reply(12,0);complete(NETMD_NO_ERROR);
    assert(now_ms==6000 && last_timeout==15000);

    /* Polling and the reply read share one budget; it cannot restart per poll. */
    reset(0x81);add(1,4,4,6000);add(1,4,4,6000);available(6000);reply(12,0);
    complete(NETMD_NO_ERROR);assert(now_ms==19005 && last_timeout==1995);

    /* An indefinitely blocked poll fails once, without a command retry. */
    reset(0x81);add(1,4,LIBUSB_ERROR_TIMEOUT,20000);complete(NETMD_USB_ERROR);
    assert(now_ms==21000 && commands==1);

    /* No extra USB request after the overall response budget is used. */
    reset(0x81);available(20000);complete(NETMD_USB_ERROR);assert(now_ms==21000);

    reset(0x81);add(1,4,LIBUSB_ERROR_NO_DEVICE,0);complete(NETMD_USB_ERROR);
    assert(now_ms==1000);

    reset(0x81);available(5000);reply(3,0);complete(NETMD_USB_ERROR);

    reset(0x81);steps[1].result=LIBUSB_ERROR_PIPE;complete(NETMD_USB_ERROR);

    /* Refuse a pending old reply before sending a new command. */
    reset(0x81);count=1;steps[0].data[0]=1;steps[0].data[2]=12;
    complete(NETMD_USB_ERROR);assert(commands==0);

    /* Ordinary commands keep their original one-second USB limit. */
    reset(0x80);available(0);reply(12,0);complete(NETMD_NO_ERROR);
    assert(last_timeout==1000);
    puts("Native session closing: 9 cases passed (slow reply, shared deadline, no retries, disconnect and short transfers).");
}
