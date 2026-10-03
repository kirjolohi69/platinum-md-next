/* Synthetic USB failures; no recorder access. SPDX-License-Identifier: LGPL-2.1-or-later */
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "common.h"
#include "const.h"
#include "log.h"

typedef struct { int request, length, result; unsigned char data[16]; } step;
static step steps[8];
static int count, cursor;
int LIBUSB_CALL libusb_control_transfer(libusb_device_handle *dev, uint8_t type,
        uint8_t request, uint16_t value, uint16_t index, unsigned char *data,
        uint16_t length, unsigned int timeout) {
    (void)dev;(void)type;(void)value;(void)index;(void)timeout;
    assert(cursor < count);
    step *s = &steps[cursor++];
    assert(request == s->request && length == s->length);
    if ((type & LIBUSB_ENDPOINT_IN) && s->result > 0) memcpy(data, s->data, (size_t)s->result);
    return s->result;
}
const char * LIBUSB_CALL libusb_error_name(int code) { (void)code; return "stub USB error"; }
static void reset(void) { memset(steps,0,sizeof(steps)); count=cursor=0; }
static void add(int request,int length,int result) { steps[count++]=(step){request,length,result,{0}}; }
static void run_failure(void) {
    unsigned char command[2]={0,1}, response[255];
    memset(response,0xa5,sizeof(response));
    assert(netmd_exch_message(NULL,command,sizeof(command),response)<0);
    assert(cursor==count);
}
int main(void) {
    netmd_set_log_level(NETMD_LOG_NONE);
    reset();add(1,4,LIBUSB_ERROR_TIMEOUT);run_failure();
    reset();add(1,4,3);run_failure();
    reset();add(1,4,4);steps[0].data[0]=1;steps[0].data[2]=8;run_failure();
    reset();add(1,4,4);add(0x80,2,1);run_failure();
    reset();add(1,4,4);add(0x80,2,LIBUSB_ERROR_PIPE);run_failure();
    reset();add(1,4,4);add(0x80,2,2);add(1,4,4);
    steps[2].data[0]=1;steps[2].data[1]=0x81;steps[2].data[2]=8;
    add(0x81,8,3);run_failure();
    reset();add(1,4,4);add(0x80,2,2);add(1,4,4);
    steps[2].data[0]=1;steps[2].data[1]=0x81;steps[2].data[2]=8;
    add(0x81,8,8);steps[3].data[0]=NETMD_STATUS_ACCEPTED;
    unsigned char command[2]={0,1}, response[255]={0};
    assert(netmd_exch_message(NULL,command,2,response)==8);
    assert(response[0]==NETMD_STATUS_ACCEPTED && cursor==count);
    puts("Native transport: 7 cases passed (no receive after failed send, no short transfers accepted).");
}
